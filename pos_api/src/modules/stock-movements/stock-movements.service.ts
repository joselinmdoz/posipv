import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AccountingService } from "../accounting/accounting.service";

@Injectable()
export class StockMovementsService {
  constructor(
    private prisma: PrismaService,
    private accountingService: AccountingService,
  ) {}

  list(params?: { warehouseId?: string; from?: string; to?: string; type?: "IN" | "OUT" | "TRANSFER"; reason?: string }) {
    const where: any = {};
    if (params?.warehouseId) {
      where.OR = [
        { fromWarehouseId: params.warehouseId },
        { toWarehouseId: params.warehouseId },
      ];
    }

    if (params?.type) {
      const validTypes = new Set(["IN", "OUT", "TRANSFER"]);
      if (!validTypes.has(params.type)) {
        throw new BadRequestException("Tipo de movimiento inválido.");
      }
      where.type = params.type;
    }

    if (params?.reason?.trim()) {
      where.reason = { contains: params.reason.trim(), mode: "insensitive" };
    }

    const fromDate = params?.from ? this.parseDateParam(params.from, false) : null;
    const toDate = params?.to ? this.parseDateParam(params.to, true) : null;

    if (params?.from && !fromDate) {
      throw new BadRequestException("Fecha 'from' inválida.");
    }
    if (params?.to && !toDate) {
      throw new BadRequestException("Fecha 'to' inválida.");
    }
    if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
      throw new BadRequestException("El rango de fechas es inválido.");
    }

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = fromDate;
      if (toDate) where.createdAt.lte = toDate;
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

  private parseDateParam(value: string, endOfDay: boolean): Date | null {
    const trimmed = value.trim();
    if (!trimmed) return null;

    // If query arrives as YYYY-MM-DD, use server-local boundaries for the full day.
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [y, m, d] = trimmed.split("-").map(Number);
      const date = endOfDay
        ? new Date(y, m - 1, d, 23, 59, 59, 999)
        : new Date(y, m - 1, d, 0, 0, 0, 0);
      if (
        date.getFullYear() !== y ||
        date.getMonth() !== m - 1 ||
        date.getDate() !== d
      ) {
        return null;
      }
      return date;
    }

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  async create(dto: {
    type: "IN" | "OUT" | "TRANSFER";
    productId: string;
    qty: number;
    fromWarehouseId?: string | null;
    toWarehouseId?: string | null;
    reason?: string | null;
  }, createdByUserId: string) {
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

      await this.accountingService.postAutomatedStockMovementEntry(
        tx,
        movement.id,
        createdByUserId,
      );

      return movement;
    });
  }

  async delete(movementId: string, deletedByUserId: string) {
    const movement = await this.prisma.stockMovement.findUnique({
      where: { id: movementId },
      include: {
        product: { select: { id: true, name: true } },
        fromWarehouse: { select: { id: true, name: true } },
        toWarehouse: { select: { id: true, name: true } },
      },
    });
    if (!movement) throw new NotFoundException("Movimiento no encontrado.");

    if (this.isProtectedSystemMovement(movement.reason)) {
      throw new BadRequestException(
        "No se puede eliminar un movimiento generado automáticamente por ventas o procesos del sistema.",
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (movement.type === "IN") {
        if (!movement.toWarehouseId) {
          throw new BadRequestException("Movimiento IN inválido: no tiene almacén de destino.");
        }
        await this.adjustStock(tx, movement.toWarehouseId, movement.productId, -Number(movement.qty));
      } else if (movement.type === "OUT") {
        if (!movement.fromWarehouseId) {
          throw new BadRequestException("Movimiento OUT inválido: no tiene almacén de origen.");
        }
        await this.adjustStock(tx, movement.fromWarehouseId, movement.productId, Number(movement.qty));
      } else if (movement.type === "TRANSFER") {
        if (!movement.fromWarehouseId || !movement.toWarehouseId) {
          throw new BadRequestException("Movimiento TRANSFER inválido: faltan almacenes.");
        }
        await this.adjustStock(tx, movement.fromWarehouseId, movement.productId, Number(movement.qty));
        await this.adjustStock(tx, movement.toWarehouseId, movement.productId, -Number(movement.qty));
      }

      await this.accountingService.voidAutomatedStockMovementEntry(
        tx,
        movement.id,
        `ELIMINACION_MOVIMIENTO:${movement.id}:${deletedByUserId}`,
      );

      await tx.stockMovement.delete({ where: { id: movement.id } });
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

  private isProtectedSystemMovement(reason?: string | null): boolean {
    const value = (reason || "").trim().toUpperCase();
    if (!value) return false;
    return (
      value === "VENTA" ||
      value === "VENTA_DIRECTA" ||
      value.startsWith("ELIMINACION_VENTA:") ||
      value.startsWith("RESET_STOCK:") ||
      value.startsWith("COMPRA:") ||
      value.startsWith("ANULACION_COMPRA:")
    );
  }
}
