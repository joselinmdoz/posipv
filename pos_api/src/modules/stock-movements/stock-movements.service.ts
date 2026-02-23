import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
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
    type: "IN" | "OUT" | "TRANSFER";
    productId: string;
    qty: number;
    fromWarehouseId?: string | null;
    toWarehouseId?: string | null;
    reason?: string | null;
  }) {
    const normalized = {
      type: dto.type,
      productId: this.normalizeId(dto.productId),
      qty: Number(dto.qty),
      fromWarehouseId: this.normalizeId(dto.fromWarehouseId),
      toWarehouseId: this.normalizeId(dto.toWarehouseId),
      reason: dto.reason?.trim() || null,
    };

    if (!normalized.productId) throw new BadRequestException("productId es requerido.");
    const productId = normalized.productId;
    if (!Number.isFinite(normalized.qty) || normalized.qty <= 0 || !Number.isInteger(normalized.qty)) {
      throw new BadRequestException("qty debe ser un entero mayor a 0.");
    }

    if (normalized.type === "IN" && !normalized.toWarehouseId) {
      throw new BadRequestException("toWarehouseId requerido para movimiento IN.");
    }
    if (normalized.type === "OUT" && !normalized.fromWarehouseId) {
      throw new BadRequestException("fromWarehouseId requerido para movimiento OUT.");
    }
    if (normalized.type === "TRANSFER" && (!normalized.fromWarehouseId || !normalized.toWarehouseId)) {
      throw new BadRequestException("fromWarehouseId y toWarehouseId requeridos para TRANSFER.");
    }
    if (
      normalized.type === "TRANSFER" &&
      normalized.fromWarehouseId &&
      normalized.toWarehouseId &&
      normalized.fromWarehouseId === normalized.toWarehouseId
    ) {
      throw new BadRequestException("Origen y destino no pueden ser el mismo almacén.");
    }

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, active: true },
    });
    if (!product || !product.active) {
      throw new NotFoundException("Producto no existe o está inactivo.");
    }

    const warehouseIds = [normalized.fromWarehouseId, normalized.toWarehouseId].filter(
      (id): id is string => Boolean(id)
    );
    if (warehouseIds.length > 0) {
      const warehouses = await this.prisma.warehouse.findMany({
        where: { id: { in: warehouseIds }, active: true },
        select: { id: true },
      });
      if (warehouses.length !== warehouseIds.length) {
        throw new NotFoundException("Almacén de origen o destino no existe o está inactivo.");
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const movement = await tx.stockMovement.create({
        data: {
          type: normalized.type,
          productId,
          qty: normalized.qty,
          fromWarehouseId: normalized.fromWarehouseId,
          toWarehouseId: normalized.toWarehouseId,
          reason: normalized.reason,
        },
        include: {
          product: { select: { id: true, name: true } },
          fromWarehouse: { select: { id: true, name: true } },
          toWarehouse: { select: { id: true, name: true } },
        },
      });

      if (normalized.type === "IN") {
        const toWarehouseId = normalized.toWarehouseId;
        if (!toWarehouseId) throw new BadRequestException("toWarehouseId requerido para IN.");
        await this.adjustStock(tx, toWarehouseId, productId, normalized.qty);
      } else if (normalized.type === "OUT") {
        const fromWarehouseId = normalized.fromWarehouseId;
        if (!fromWarehouseId) throw new BadRequestException("fromWarehouseId requerido para OUT.");
        await this.adjustStock(tx, fromWarehouseId, productId, -normalized.qty);
      } else if (normalized.type === "TRANSFER") {
        const fromWarehouseId = normalized.fromWarehouseId;
        const toWarehouseId = normalized.toWarehouseId;
        if (!fromWarehouseId || !toWarehouseId) {
          throw new BadRequestException("fromWarehouseId y toWarehouseId requeridos para TRANSFER.");
        }
        await this.adjustStock(tx, fromWarehouseId, productId, -normalized.qty);
        await this.adjustStock(tx, toWarehouseId, productId, normalized.qty);
      }

      return movement;
    });
  }

  private async adjustStock(tx: any, warehouseId: string, productId: string, qty: number) {
    const existing = await tx.stock.findUnique({
      where: { warehouseId_productId: { warehouseId, productId } },
    });

    if (qty < 0) {
      const required = Math.abs(qty);
      if (!existing || existing.qty < required) {
        throw new BadRequestException("Stock insuficiente para realizar el movimiento.");
      }
    }

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

  private normalizeId(value?: string | null): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
}
