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
    const initialMap = new Map<string, number>(initial.items.map((i) => [i.productId, i.qty]));
    const productIds = new Set<string>(initial.items.map((i) => i.productId));

    const movements = await this.prisma.stockMovement.findMany({
      where: {
        createdAt: {
          gte: session.openedAt,
          lte: sessionEnd,
        },
        OR: [
          { toWarehouseId: warehouseId },
          { fromWarehouseId: warehouseId },
        ],
      },
    });

    const entriesMap = new Map<string, number>();
    const outsMap = new Map<string, number>();
    const saleReasonRegex = /VENTA/i;
    for (const mv of movements) {
      productIds.add(mv.productId);
      const qty = Number(mv.qty);

      const isInbound =
        (mv.type === 'IN' && mv.toWarehouseId === warehouseId) ||
        (mv.type === 'TRANSFER' && mv.toWarehouseId === warehouseId);
      if (isInbound) {
        entriesMap.set(mv.productId, (entriesMap.get(mv.productId) || 0) + qty);
      }

      const isOutbound =
        (mv.type === 'OUT' && mv.fromWarehouseId === warehouseId) ||
        (mv.type === 'TRANSFER' && mv.fromWarehouseId === warehouseId);
      if (isOutbound) {
        const reason = (mv.reason || '').trim();
        if (!saleReasonRegex.test(reason)) {
          outsMap.set(mv.productId, (outsMap.get(mv.productId) || 0) + qty);
        }
      }
    }

    const soldItems = await this.prisma.saleItem.findMany({
      where: {
        sale: {
          cashSessionId,
          status: SaleStatus.PAID,
          createdAt: {
            gte: session.openedAt,
            lte: sessionEnd,
          },
        },
      },
      select: {
        productId: true,
        qty: true,
      },
    });
    const salesMap = new Map<string, number>();
    for (const it of soldItems) {
      productIds.add(it.productId);
      salesMap.set(it.productId, (salesMap.get(it.productId) || 0) + Number(it.qty));
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: Array.from(productIds) } },
      select: {
        id: true,
        name: true,
        codigo: true,
        price: true,
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
      const price = Number(product?.price || 0);
      const amount = Number((sales * price).toFixed(2));

      return {
        productId,
        name: product?.name || `Producto ${productId.slice(0, 8)}`,
        codigo: product?.codigo || null,
        initial: initialQty,
        entries,
        outs,
        sales,
        total,
        final,
        price,
        amount,
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
      }),
      { initial: 0, entries: 0, outs: 0, sales: 0, total: 0, final: 0, amount: 0 }
    );

    return {
      cashSessionId,
      status: session.status,
      openedAt: session.openedAt,
      closedAt: session.closedAt,
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
      totals,
      paymentTotals: await this.getPaymentTotals(cashSessionId, session.openedAt, sessionEnd),
      closed: session.status === CashSessionStatus.CLOSED,
    };
  }

  private async getPaymentTotals(cashSessionId: string, from: Date, to: Date) {
    const grouped = await this.prisma.payment.groupBy({
      by: ['method'],
      where: {
        sale: {
          cashSessionId,
          status: SaleStatus.PAID,
          createdAt: {
            gte: from,
            lte: to,
          },
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
