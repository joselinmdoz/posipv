import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CashSessionStatus, PaymentMethod, Prisma, SaleStatus } from "@prisma/client";
import { dec, moneyEq } from "../../common/decimal";
import { InventoryReportsService } from "../inventory-reports/inventory-reports.service";

@Injectable()
export class CashSessionsService {
  constructor(
    private prisma: PrismaService,
    private inventoryReportsService: InventoryReportsService,
  ) {}

  async findAll() {
    const sessions = await this.prisma.cashSession.findMany({
      include: {
        register: {
          select: {
            id: true,
            name: true,
            code: true,
            settings: {
              select: {
                warehouseId: true,
              },
            },
          },
        },
        openedBy: {
          select: {
            id: true,
            email: true,
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: {
        openedAt: "desc",
      },
    });

    return sessions.map((session) => ({
      ...session,
      warehouseId: session.register.settings?.warehouseId || null,
      register: {
        id: session.register.id,
        name: session.register.name,
        code: session.register.code,
      },
    }));
  }

  async findOne(id: string) {
    const session = await this.prisma.cashSession.findUnique({
      where: { id },
      include: {
        register: {
          select: {
            id: true,
            name: true,
            code: true,
            settings: {
              select: {
                warehouseId: true,
              },
            },
          },
        },
        openedBy: {
          select: {
            id: true,
            email: true,
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });
    if (!session) throw new NotFoundException("Sesión no encontrada.");

    return {
      ...session,
      warehouseId: session.register.settings?.warehouseId || null,
      register: {
        id: session.register.id,
        name: session.register.name,
        code: session.register.code,
      },
    };
  }

  getOpenByRegister(registerId: string) {
    return this.prisma.cashSession.findFirst({
      where: { registerId, status: CashSessionStatus.OPEN },
      include: {
        openedBy: {
          select: {
            id: true,
            email: true,
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: { openedAt: "desc" },
    });
  }

  async open(input: { registerId: string; openingAmount: string; note?: string; openedById: string }) {
    const reg = await this.prisma.register.findUnique({ where: { id: input.registerId } });
    if (!reg || !reg.active) throw new NotFoundException("Caja no existe o está inactiva.");

    const openExisting = await this.getOpenByRegister(input.registerId);
    if (openExisting) throw new BadRequestException("Esa caja ya tiene una sesión abierta.");

    await this.assertCashierAllowedForRegister(input.registerId, input.openedById);

    const session = await this.prisma.cashSession.create({
      data: {
        registerId: input.registerId,
        openingAmount: dec(input.openingAmount) as any,
        note: input.note,
        openedById: input.openedById,
      },
      include: {
        openedBy: {
          select: {
            id: true,
            email: true,
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    await this.inventoryReportsService.ensureInitialReportForSession(session.id);
    return session;
  }

  async close(id: string, closingAmount: string, note?: string) {
    const sess = await this.prisma.cashSession.findUnique({ where: { id } });
    if (!sess) throw new NotFoundException("Sesión no encontrada.");
    if (sess.status === CashSessionStatus.CLOSED) throw new BadRequestException("Ya está cerrada.");
    const summary = await this.getSessionSummary(id);
    const enteredCash = dec(closingAmount);
    const expectedCash = dec(summary.paymentTotals.CASH);
    if (!moneyEq(enteredCash, expectedCash)) {
      throw new BadRequestException(
        `El efectivo contado (${enteredCash.toFixed(2)}) no coincide con el efectivo de ventas (${expectedCash.toFixed(2)}).`
      );
    }

    const closedAt = new Date();

    return this.prisma.cashSession.update({
      where: { id },
      data: {
        status: CashSessionStatus.CLOSED,
        closedAt,
        closingAmount: dec(closingAmount) as any,
        note,
      },
    });
  }

  async getSessionSummary(id: string) {
    const session = await this.prisma.cashSession.findUnique({
      where: { id },
      include: {
        register: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });
    if (!session) throw new NotFoundException("Sesión no encontrada.");

    const [salesAgg, paymentGroup] = await Promise.all([
      this.prisma.sale.aggregate({
        where: {
          cashSessionId: id,
          status: SaleStatus.PAID,
        },
        _sum: {
          total: true,
        },
        _count: {
          _all: true,
        },
      }),
      this.prisma.payment.groupBy({
        by: ["method"],
        where: {
          sale: {
            cashSessionId: id,
            status: SaleStatus.PAID,
          },
        },
        _sum: {
          amount: true,
        },
      }),
    ]);

    const paymentTotals = this.buildPaymentTotals(paymentGroup);
    const totalSales = dec(salesAgg._sum.total ?? 0);

    return {
      id: session.id,
      status: session.status,
      openedAt: session.openedAt,
      closedAt: session.closedAt,
      openingAmount: Number(session.openingAmount.toFixed(2)),
      register: session.register,
      salesCount: salesAgg._count._all,
      totalSales: Number(totalSales.toFixed(2)),
      paymentTotals: {
        CASH: Number(paymentTotals.CASH.toFixed(2)),
        CARD: Number(paymentTotals.CARD.toFixed(2)),
        TRANSFER: Number(paymentTotals.TRANSFER.toFixed(2)),
        OTHER: Number(paymentTotals.OTHER.toFixed(2)),
      },
    };
  }

  private buildPaymentTotals(grouped: Array<{ method: PaymentMethod; _sum: { amount: Prisma.Decimal | null } }>) {
    const totals: Record<PaymentMethod, Prisma.Decimal> = {
      CASH: dec(0),
      CARD: dec(0),
      TRANSFER: dec(0),
      OTHER: dec(0),
    };

    for (const row of grouped) {
      totals[row.method] = dec(row._sum.amount ?? 0);
    }

    return totals;
  }

  private async assertCashierAllowedForRegister(registerId: string, userId: string) {
    const settings = await this.prisma.registerSettings.findUnique({
      where: { registerId },
      select: {
        sellerEmployeeIds: true,
      },
    });

    const allowedEmployeeIds = Array.isArray(settings?.sellerEmployeeIds) ? settings.sellerEmployeeIds : [];
    if (allowedEmployeeIds.length === 0) {
      return;
    }

    const employee = await this.prisma.employee.findFirst({
      where: {
        userId,
        active: true,
      },
      select: {
        id: true,
      },
    });

    if (!employee || !allowedEmployeeIds.includes(employee.id)) {
      throw new BadRequestException("Este cajero no está autorizado para operar en el TPV seleccionado.");
    }
  }
}
