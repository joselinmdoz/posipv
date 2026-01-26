import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class StockMovementsService {
  constructor(private prisma: PrismaService) {}

  list(params?: { warehouseId?: string; from?: string; to?: string }) {
    const where: any = {};
    if (params?.warehouseId) {
      where.OR = [
        { fromWarehouseId: params.warehouseId },
        { toWarehouseId: params.warehouseId },
      ];
    }
    if (params?.from || params?.to) {
      where.createdAt = {};
      if (params.from) where.createdAt.gte = new Date(params.from);
      if (params.to) where.createdAt.lte = new Date(params.to);
    }

    return this.prisma.stockMovement.findMany({
      where,
      include: {
        product: { select: { id: true, name: true } },
        fromWarehouse: { select: { id: true, name: true } },
        toWarehouse: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(dto: {
    type: 'IN' | 'OUT' | 'TRANSFER';
    productId: string;
    qty: number;
    fromWarehouseId?: string | null;
    toWarehouseId?: string | null;
    reason?: string | null;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const movement = await tx.stockMovement.create({
        data: dto,
        include: {
          product: { select: { id: true, name: true } },
          fromWarehouse: { select: { id: true, name: true } },
          toWarehouse: { select: { id: true, name: true } },
        },
      });

      // Update stock
      if (dto.type === 'IN') {
        if (!dto.toWarehouseId) throw new Error('toWarehouseId required for IN');
        await this.adjustStock(tx, dto.toWarehouseId, dto.productId, dto.qty);
      } else if (dto.type === 'OUT') {
        if (!dto.fromWarehouseId) throw new Error('fromWarehouseId required for OUT');
        await this.adjustStock(tx, dto.fromWarehouseId, dto.productId, -dto.qty);
      } else if (dto.type === 'TRANSFER') {
        if (!dto.fromWarehouseId || !dto.toWarehouseId) throw new Error('fromWarehouseId and toWarehouseId required for TRANSFER');
        await this.adjustStock(tx, dto.fromWarehouseId, dto.productId, -dto.qty);
        await this.adjustStock(tx, dto.toWarehouseId, dto.productId, dto.qty);
      }

      return movement;
    });
  }

  private async adjustStock(tx: any, warehouseId: string, productId: string, qty: number) {
    const existing = await tx.stock.findUnique({
      where: { warehouseId_productId: { warehouseId, productId } },
    });
    if (existing) {
      await tx.stock.update({
        where: { warehouseId_productId: { warehouseId, productId } },
        data: { qty: { increment: qty } },
      });
    } else {
      await tx.stock.create({
        data: { warehouseId, productId, qty },
      });
    }
  }
}