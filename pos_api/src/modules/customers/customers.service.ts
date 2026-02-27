import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, SaleStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { dec } from "../../common/decimal";

type ListCustomersInput = {
  q?: string;
  active?: string;
  limit?: string;
};

type CreateCustomerInput = {
  name: string;
  identification: string;
  phone?: string;
  email?: string;
  address?: string;
};

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(input: ListCustomersInput) {
    const q = this.normalize(input.q);
    const activeFilter = this.parseActive(input.active);
    const limit = this.parseLimit(input.limit);

    const where: Prisma.ClientWhereInput = {
      ...(activeFilter === null ? {} : { active: activeFilter }),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { identification: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.client.findMany({
      where,
      orderBy: [{ name: "asc" }, { createdAt: "desc" }],
      take: limit,
      select: {
        id: true,
        name: true,
        identification: true,
        phone: true,
        email: true,
        address: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!rows.length) return [];

    const ids = rows.map((row) => row.id);
    const grouped = await this.prisma.sale.groupBy({
      by: ["customerId"],
      where: {
        customerId: { in: ids },
        status: { not: SaleStatus.VOID },
      },
      _count: { _all: true },
      _sum: { total: true },
      _max: { createdAt: true },
    });

    const statsByCustomer = new Map(
      grouped
        .filter((row) => !!row.customerId)
        .map((row) => [
          row.customerId as string,
          {
            purchasesCount: row._count._all,
            totalAmount: Number((row._sum.total || dec(0)).toFixed(2)),
            lastPurchaseAt: row._max.createdAt || null,
          },
        ]),
    );

    return rows.map((row) => ({
      ...row,
      purchasesCount: statsByCustomer.get(row.id)?.purchasesCount || 0,
      totalAmount: statsByCustomer.get(row.id)?.totalAmount || 0,
      lastPurchaseAt: statsByCustomer.get(row.id)?.lastPurchaseAt || null,
    }));
  }

  async create(input: CreateCustomerInput) {
    const name = this.normalizeRequired(input.name, "Nombre de cliente requerido.");
    const identification = this.normalizeRequired(input.identification, "Identificación requerida.");

    try {
      return await this.prisma.client.create({
        data: {
          name,
          identification,
          phone: this.normalize(input.phone) || undefined,
          email: this.normalize(input.email) || undefined,
          address: this.normalize(input.address) || undefined,
          active: true,
        },
        select: {
          id: true,
          name: true,
          identification: true,
          phone: true,
          email: true,
          address: true,
          active: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Ya existe un cliente con esa identificación.");
      }
      throw new BadRequestException("No se pudo crear el cliente.");
    }
  }

  async getHistory(clientId: string) {
    const customer = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        name: true,
        identification: true,
        phone: true,
        email: true,
        address: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!customer) {
      throw new NotFoundException("Cliente no encontrado.");
    }

    const [aggregates, sales] = await Promise.all([
      this.prisma.sale.aggregate({
        where: {
          customerId: clientId,
          status: { not: SaleStatus.VOID },
        },
        _count: { _all: true },
        _sum: { total: true },
        _max: { createdAt: true },
      }),
      this.prisma.sale.findMany({
        where: {
          customerId: clientId,
          status: { not: SaleStatus.VOID },
        },
        orderBy: { createdAt: "desc" },
        take: 25,
        select: {
          id: true,
          documentNumber: true,
          channel: true,
          total: true,
          createdAt: true,
          warehouse: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          cashier: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      }),
    ]);

    return {
      customer,
      summary: {
        purchasesCount: aggregates._count._all || 0,
        totalAmount: Number((aggregates._sum.total || dec(0)).toFixed(2)),
        lastPurchaseAt: aggregates._max.createdAt || null,
      },
      recentSales: sales.map((sale) => ({
        id: sale.id,
        documentNumber: sale.documentNumber,
        channel: sale.channel,
        total: Number(sale.total.toFixed(2)),
        createdAt: sale.createdAt,
        warehouse: sale.warehouse,
        cashier: sale.cashier,
      })),
    };
  }

  private normalize(value?: string | null): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }

  private normalizeRequired(value: string | undefined, message: string): string {
    const normalized = this.normalize(value);
    if (!normalized) throw new BadRequestException(message);
    return normalized;
  }

  private parseActive(value?: string): boolean | null {
    if (value === undefined || value === null || value === "") return true;
    if (value === "true") return true;
    if (value === "false") return false;
    throw new BadRequestException("Parámetro active inválido. Use true o false.");
  }

  private parseLimit(value?: string): number {
    if (!value) return 100;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new BadRequestException("Parámetro limit inválido.");
    }
    return Math.min(200, Math.floor(parsed));
  }
}
