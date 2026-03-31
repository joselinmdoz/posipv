import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CashSessionStatus, IPVType, InventoryReport, PaymentMethod, SaleStatus } from '@prisma/client';
import { dec } from '../../common/decimal';

@Injectable()
export class InventoryReportsService {
  constructor(private prisma: PrismaService) {}

  async createInitial(cashSessionId: string, warehouseId: string) {
    const session = await this.requireSessionWithWarehouse(cashSessionId);
    if (session.register.warehouse!.id !== warehouseId) {
      throw new BadRequestException('El almacén no corresponde con la sesión.');
    }
    return this.ensureInitialReportForSession(cashSessionId);
  }

  async createFinal(cashSessionId: string, warehouseId: string) {
    const session = await this.requireSessionWithWarehouse(cashSessionId);
    if (session.register.warehouse!.id !== warehouseId) {
      throw new BadRequestException('El almacén no corresponde con la sesión.');
    }
    throw new BadRequestException(
      'Ahora existe un solo IPV por sesión. Se crea al abrir caja y se cierra al cerrar la sesión.',
    );
  }

  async findBySession(cashSessionId: string) {
    return this.prisma.inventoryReport.findMany({
      where: { cashSessionId },
      include: {
        items: {
          include: { product: true },
        },
        warehouse: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByWarehouse(warehouseId: string, startDate?: Date, endDate?: Date) {
    const where: any = { warehouseId };
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    return this.prisma.inventoryReport.findMany({
      where,
      include: {
        items: {
          include: { product: true },
        },
        cashSession: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.inventoryReport.findUnique({
      where: { id },
      include: {
        items: {
          include: { product: true },
        },
        warehouse: true,
        cashSession: {
          include: {
            openedBy: true,
            register: true,
          },
        },
      },
    });
  }

  async delete(id: string) {
    const report = await this.prisma.inventoryReport.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!report) throw new NotFoundException("Reporte IPV no encontrado.");

    return this.prisma.$transaction(async (tx) => {
      await tx.inventoryReportItem.deleteMany({
        where: { inventoryReportId: id },
      });
      await tx.inventoryReport.delete({
        where: { id },
      });
      return { ok: true, deletedReportId: id };
    });
  }

  async deleteBySession(cashSessionId: string) {
    const reports = await this.prisma.inventoryReport.findMany({
      where: { cashSessionId },
      select: { id: true },
    });
    if (!reports.length) {
      throw new NotFoundException("No existen reportes IPV para la sesión indicada.");
    }

    const reportIds = reports.map((report) => report.id);
    return this.prisma.$transaction(async (tx) => {
      await tx.inventoryReportItem.deleteMany({
        where: { inventoryReportId: { in: reportIds } },
      });
      await tx.inventoryReport.deleteMany({
        where: { id: { in: reportIds } },
      });
      return { ok: true, cashSessionId, deletedReports: reportIds.length };
    });
  }

  async getLatestBySession(cashSessionId: string, type?: IPVType) {
    const where: any = { cashSessionId };
    if (type) where.type = type;

    return this.prisma.inventoryReport.findFirst({
      where,
      include: {
        items: {
          include: { product: true },
        },
        warehouse: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async ensureInitialReportForSession(cashSessionId: string): Promise<InventoryReport> {
    const session = await this.requireSessionWithWarehouse(cashSessionId);
    const warehouseId = session.register.warehouse!.id;

    const existing = await this.prisma.inventoryReport.findFirst({
      where: {
        cashSessionId,
        type: IPVType.INITIAL,
      },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) return existing;

    const items = await this.buildInitialItemsForSession(cashSessionId);

    const totalValue = Number(items.reduce((sum, item) => sum + item.total, 0).toFixed(2));
    return this.prisma.inventoryReport.create({
      data: {
        type: IPVType.INITIAL,
        createdAt: session.openedAt,
        cashSessionId,
        warehouseId,
        totalValue: dec(totalValue.toString()) as any,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            qty: item.qty,
            price: dec(item.price.toString()) as any,
            total: dec(item.total.toString()) as any,
          })),
        },
      },
    });
  }

  async getSessionIpvReport(cashSessionId: string, asOf?: Date) {
    const session = await this.requireSessionWithWarehouse(cashSessionId);
    const warehouseId = session.register.warehouse!.id;
    await this.ensureInitialReportForSession(cashSessionId);

    const initial = await this.prisma.inventoryReport.findFirst({
      where: {
        cashSessionId,
        type: IPVType.INITIAL,
      },
      include: {
        items: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!initial) throw new BadRequestException('No se pudo inicializar el IPV de la sesión.');

    const sessionEnd = asOf || session.closedAt || new Date();
    const previousClosedSession = await this.prisma.cashSession.findFirst({
      where: {
        id: { not: cashSessionId },
        registerId: session.registerId,
        status: CashSessionStatus.CLOSED,
        closedAt: { lt: session.openedAt },
      },
      select: { closedAt: true },
      orderBy: { closedAt: 'desc' },
    });

    const initialMap = new Map<string, number>(initial.items.map((i) => [i.productId, Number(i.qty)]));
    const productIds = new Set<string>(initial.items.map((i) => i.productId));

    const movementCreatedAtFilter: { lte: Date; gte?: Date; gt?: Date } = {
      lte: sessionEnd,
    };
    if (previousClosedSession?.closedAt) {
      // Include carry-over movements between last close and this opening.
      movementCreatedAtFilter.gt = previousClosedSession.closedAt;
    } else {
      // First known session: keep movement window inside current session only.
      movementCreatedAtFilter.gte = session.openedAt;
    }

    const movements = await this.prisma.stockMovement.findMany({
      where: {
        createdAt: movementCreatedAtFilter,
        OR: [
          { toWarehouseId: warehouseId },
          { fromWarehouseId: warehouseId },
        ],
      },
    });

    const entriesMap = new Map<string, number>();
    const outsMap = new Map<string, number>();
    const saleReasonRegex = /VENTA/i;
    const tpvSessionReasonRegex = /TPV[_\s-]*SESION/i;
    const legacyTpvSessionReasonRegex = /AJUSTE\s+EN\s+TPV\s*\(\s*SESION\s*\)/i;
    const isFirstKnownSession = !previousClosedSession?.closedAt;
    let entriesCount = 0;
    let outsCount = 0;
    for (const mv of movements) {
      productIds.add(mv.productId);
      const qty = Number(mv.qty);
      const isSessionWindowMovement = mv.createdAt >= session.openedAt;
      const reason = (mv.reason || '').trim();
      const isTpvSessionMovement =
        tpvSessionReasonRegex.test(reason) || legacyTpvSessionReasonRegex.test(reason);

      const isInbound =
        (mv.type === 'IN' && mv.toWarehouseId === warehouseId) ||
        (mv.type === 'TRANSFER' && mv.toWarehouseId === warehouseId);
      if (isInbound) {
        const isCarryIntoInitial = isFirstKnownSession && !isTpvSessionMovement;
        if (isCarryIntoInitial) {
          initialMap.set(mv.productId, Number((initialMap.get(mv.productId) || 0) + qty));
        } else {
          entriesMap.set(mv.productId, Number((entriesMap.get(mv.productId) || 0) + qty));
          if (mv.type === 'IN' && mv.toWarehouseId === warehouseId) {
            entriesCount += 1;
          }
        }
      }

      const isOutbound =
        (mv.type === 'OUT' && mv.fromWarehouseId === warehouseId) ||
        (mv.type === 'TRANSFER' && mv.fromWarehouseId === warehouseId);
      if (isOutbound) {
        // Exclude sale movements only during this session to avoid double count with salesMap.
        const isSaleOutInsideSession = isSessionWindowMovement && saleReasonRegex.test(reason);
        if (!isSaleOutInsideSession) {
          const isCarryIntoInitial = isFirstKnownSession && !isTpvSessionMovement;
          if (isCarryIntoInitial) {
            initialMap.set(mv.productId, Number((initialMap.get(mv.productId) || 0) - qty));
          } else {
            outsMap.set(mv.productId, Number((outsMap.get(mv.productId) || 0) + qty));
          }
        }
      }
      if (mv.type === 'OUT' && mv.fromWarehouseId === warehouseId) {
        if (!saleReasonRegex.test(reason)) {
          const isCarryIntoInitial = isFirstKnownSession && !isTpvSessionMovement;
          if (!isCarryIntoInitial) {
            outsCount += 1;
          }
        }
      }
    }

    const soldItems = await this.prisma.saleItem.findMany({
      where: {
        sale: {
          cashSessionId,
          status: SaleStatus.PAID,
        },
      },
      select: {
        productId: true,
        qty: true,
        price: true,
        costSnapshot: true,
      },
    });
    const salesMap = new Map<string, number>();
    const salesAmountMap = new Map<string, number>();
    const salesCostAmountMap = new Map<string, number>();
    const salesMissingCostQtyMap = new Map<string, number>();
    for (const it of soldItems) {
      productIds.add(it.productId);
      const qty = Number(it.qty);
      const unitPrice = Number(it.price || 0);
      const unitCostSnapshot = it.costSnapshot != null ? Number(it.costSnapshot) : null;

      salesMap.set(it.productId, Number(((salesMap.get(it.productId) || 0) + qty).toFixed(6)));
      salesAmountMap.set(
        it.productId,
        Number(((salesAmountMap.get(it.productId) || 0) + qty * unitPrice).toFixed(2))
      );

      if (unitCostSnapshot != null) {
        salesCostAmountMap.set(
          it.productId,
          Number(((salesCostAmountMap.get(it.productId) || 0) + qty * unitCostSnapshot).toFixed(2))
        );
      } else {
        salesMissingCostQtyMap.set(
          it.productId,
          Number(((salesMissingCostQtyMap.get(it.productId) || 0) + qty).toFixed(6))
        );
      }
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: Array.from(productIds) } },
      select: {
        id: true,
        name: true,
        codigo: true,
        price: true,
        cost: true,
        currency: true,
      },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const lines = Array.from(productIds).map((productId) => {
      const product = productMap.get(productId);
      const initialQty = Number(initialMap.get(productId) || 0);
      const entries = Number(entriesMap.get(productId) || 0);
      const outs = Number(outsMap.get(productId) || 0);
      const sales = Number(salesMap.get(productId) || 0);
      const total = initialQty + entries - outs;
      const final = total - sales;
      const currentProductPrice = Number(product?.price || 0);
      const salesAmount = Number(salesAmountMap.get(productId) || 0);
      const linePrice = sales > 0 ? Number((salesAmount / sales).toFixed(2)) : currentProductPrice;
      const fallbackUnitCost = Number(product?.cost || 0);
      const knownCostAmount = Number(salesCostAmountMap.get(productId) || 0);
      const missingCostQty = Number(salesMissingCostQtyMap.get(productId) || 0);
      const totalCostAmount = Number((knownCostAmount + (missingCostQty * fallbackUnitCost)).toFixed(2));
      const gain = Number((salesAmount - totalCostAmount).toFixed(2));
      const gp = sales > 0 ? Number((gain / sales).toFixed(2)) : 0;
      const amount = Number(salesAmount.toFixed(2));

      return {
        productId,
        name: product?.name || `Producto ${productId.slice(0, 8)}`,
        codigo: product?.codigo || null,
        currency: product?.currency || 'CUP',
        initial: initialQty,
        entries,
        outs,
        sales,
        total,
        final,
        price: linePrice,
        amount,
        gp,
        gain,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));

    const totals = lines.reduce(
      (acc, line) => ({
        initial: acc.initial + line.initial,
        entries: acc.entries + line.entries,
        outs: acc.outs + line.outs,
        sales: acc.sales + line.sales,
        total: acc.total + line.total,
        final: acc.final + line.final,
        amount: Number((acc.amount + line.amount).toFixed(2)),
        profit: Number((acc.profit + line.gain).toFixed(2)),
      }),
      { initial: 0, entries: 0, outs: 0, sales: 0, total: 0, final: 0, amount: 0, profit: 0 }
    );

    const [paymentTotals, salesCount] = await Promise.all([
      this.getPaymentTotals(cashSessionId, session.openedAt, sessionEnd),
      this.prisma.sale.count({
        where: {
          cashSessionId,
          status: SaleStatus.PAID,
        },
      }),
    ]);

    return {
      cashSessionId,
      status: session.status,
      openedAt: session.openedAt,
      closedAt: session.closedAt,
      responsible: {
        userId: session.openedBy.id,
        email: session.openedBy.email,
        employeeId: session.openedBy.employee?.id || null,
        employeeName: session.openedBy.employee
          ? `${session.openedBy.employee.firstName} ${session.openedBy.employee.lastName}`.trim()
          : null,
      },
      register: {
        id: session.register.id,
        name: session.register.name,
        code: session.register.code,
      },
      warehouse: {
        id: session.register.warehouse!.id,
        name: session.register.warehouse!.name,
        code: session.register.warehouse!.code,
      },
      lines,
      totals: {
        ...totals,
        salesCount,
        entriesCount,
        outsCount,
      },
      paymentTotals,
      closed: session.status === CashSessionStatus.CLOSED,
    };
  }

  private async getPaymentTotals(cashSessionId: string, _from: Date, _to: Date) {
    const grouped = await this.prisma.payment.groupBy({
      by: ['method'],
      where: {
        sale: {
          cashSessionId,
          status: SaleStatus.PAID,
        },
      },
      _sum: { amount: true },
    });

    const map = new Map(grouped.map((g) => [g.method, Number(g._sum.amount || 0)]));
    return {
      CASH: Number((map.get(PaymentMethod.CASH) || 0).toFixed(2)),
      CARD: Number((map.get(PaymentMethod.CARD) || 0).toFixed(2)),
      TRANSFER: Number((map.get(PaymentMethod.TRANSFER) || 0).toFixed(2)),
      OTHER: Number((map.get(PaymentMethod.OTHER) || 0).toFixed(2)),
    };
  }

  private async buildInitialItemsForSession(cashSessionId: string) {
    const session = await this.requireSessionWithWarehouse(cashSessionId);
    const warehouseId = session.register.warehouse!.id;

    const previousSession = await this.prisma.cashSession.findFirst({
      where: {
        id: { not: cashSessionId },
        registerId: session.registerId,
        status: CashSessionStatus.CLOSED,
        closedAt: {
          lt: session.openedAt,
        },
      },
      select: {
        id: true,
        closedAt: true,
      },
      orderBy: {
        closedAt: 'desc',
      },
    });

    if (previousSession?.closedAt) {
      const previousIpv = await this.getSessionIpvReport(previousSession.id, previousSession.closedAt);
      const previousProductIds = previousIpv.lines.map((line) => line.productId);
      const products = await this.prisma.product.findMany({
        where: { id: { in: previousProductIds } },
        select: {
          id: true,
          price: true,
        },
      });
      const productPriceMap = new Map(products.map((p) => [p.id, Number(p.price)]));

      return previousIpv.lines.map((line) => {
        const qty = Number(line.final);
        const price = Number(productPriceMap.get(line.productId) ?? line.price ?? 0);
        return {
          productId: line.productId,
          qty,
          price,
          total: Number((qty * price).toFixed(2)),
        };
      });
    }

    const stock = await this.prisma.stock.findMany({
      where: { warehouseId },
      include: { product: true },
    });
    return stock.map((s) => {
      const price = Number(s.product.price);
      const qty = Number(s.qty);
      return {
        productId: s.productId,
        qty,
        price,
        total: Number((qty * price).toFixed(2)),
      };
    });
  }

  private async requireSessionWithWarehouse(cashSessionId: string) {
    const session = await this.prisma.cashSession.findUnique({
      where: { id: cashSessionId },
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
        register: {
          include: {
            warehouse: true,
          },
        },
      },
    });
    if (!session) throw new NotFoundException('Sesión de caja no existe.');
    if (!session.register.warehouse?.id) {
      throw new BadRequestException('El TPV no tiene almacén asociado.');
    }
    return session;
  }
}
