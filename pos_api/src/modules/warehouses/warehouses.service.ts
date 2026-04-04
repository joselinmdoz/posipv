import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CashSessionStatus, StockMovementType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class WarehousesService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.warehouse.findMany({
      where: { active: true },
      orderBy: { createdAt: "desc" },
    });
  }

  create(dto: { name: string; code: string; type?: string }) {
    return this.prisma.warehouse.create({
      data: {
        name: dto.name,
        code: dto.code,
        type: dto.type as any || 'TPV',
      },
    });
  }

  getStock(warehouseId: string) {
    return this.prisma.stock.findMany({
      where: { warehouseId },
      include: {
        product: {
          include: {
            productType: true,
            productCategory: true,
            measurementUnit: true,
          },
        },
      },
      orderBy: { product: { name: 'asc' } },
    });
  }

  findOne(id: string) {
    return this.prisma.warehouse.findUnique({
      where: { id },
    });
  }

  update(id: string, dto: { name?: string; code?: string; type?: 'CENTRAL' | 'TPV'; active?: boolean }) {
    return this.prisma.warehouse.update({
      where: { id },
      data: dto as any,
    });
  }

  delete(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const warehouse = await tx.warehouse.findUnique({
        where: { id },
        include: {
          register: {
            select: {
              cashSessions: {
                where: { status: CashSessionStatus.OPEN },
                select: { id: true },
              },
            },
          },
        },
      });
      if (!warehouse) throw new NotFoundException("Almacén no encontrado.");
      if (warehouse.register?.cashSessions?.length) {
        throw new BadRequestException("No se puede eliminar el almacén mientras exista una sesión de caja abierta.");
      }

      return tx.warehouse.update({
        where: { id },
        data: { active: false },
      });
    });
  }

  async resetStock(id: string, reason?: string) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
      select: { id: true, name: true, active: true },
    });
    if (!warehouse) throw new NotFoundException("Almacén no encontrado.");
    if (!warehouse.active) throw new BadRequestException("No se puede resetear stock de un almacén inactivo.");

    const rows = await this.prisma.stock.findMany({
      where: {
        warehouseId: id,
        qty: { gt: 0 },
      },
      select: {
        id: true,
        productId: true,
        qty: true,
      },
    });

    if (rows.length === 0) {
      return { ok: true, warehouseId: id, resetProducts: 0, resetQty: 0 };
    }

    const safeReason = (reason || "Reinicio manual").trim();

    return this.prisma.$transaction(async (tx) => {
      for (const row of rows) {
        await tx.stockMovement.create({
          data: {
            type: StockMovementType.OUT,
            productId: row.productId,
            qty: row.qty,
            fromWarehouseId: id,
            reason: `RESET_STOCK:${safeReason}`,
          },
        });
      }

      await tx.stock.updateMany({
        where: {
          warehouseId: id,
          qty: { gt: 0 },
        },
        data: {
          qty: 0,
        },
      });

      const resetQty = rows.reduce((sum, row) => sum + Number(row.qty), 0);
      return {
        ok: true,
        warehouseId: id,
        resetProducts: rows.length,
        resetQty,
      };
    });
  }

  async updateStockQty(warehouseId: string, productId: string, qty: number, reason?: string) {
    const normalizedQty = Number(qty);
    if (!Number.isFinite(normalizedQty) || normalizedQty < 0) {
      throw new BadRequestException("La cantidad debe ser un número válido mayor o igual a 0.");
    }

    const [warehouse, product, existing] = await Promise.all([
      this.prisma.warehouse.findUnique({
        where: { id: warehouseId },
        select: { id: true, active: true },
      }),
      this.prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, active: true, allowFractionalQty: true },
      }),
      this.prisma.stock.findUnique({
        where: { warehouseId_productId: { warehouseId, productId } },
        select: { id: true, qty: true },
      }),
    ]);

    if (!warehouse || !warehouse.active) {
      throw new NotFoundException("Almacén no encontrado o inactivo.");
    }
    if (!product || !product.active) {
      throw new NotFoundException("Producto no encontrado o inactivo.");
    }
    if (!existing) {
      throw new NotFoundException("No existe stock de este producto en el almacén.");
    }

    const safeQty = product.allowFractionalQty
      ? Number(normalizedQty.toFixed(2))
      : Math.floor(normalizedQty);
    if (!product.allowFractionalQty && !Number.isInteger(normalizedQty)) {
      throw new BadRequestException("Este producto solo admite cantidades enteras.");
    }

    const currentQty = Number(existing.qty);
    const delta = Number((safeQty - currentQty).toFixed(2));
    if (delta === 0) {
      return this.prisma.stock.findUnique({
        where: { id: existing.id },
        include: {
          product: {
            include: {
              productType: true,
              productCategory: true,
              measurementUnit: true,
            },
          },
        },
      });
    }

    const movementReason = `AJUSTE_STOCK:${(reason || "Ajuste manual de stock").trim()}`;

    return this.prisma.$transaction(async (tx) => {
      if (delta > 0) {
        await tx.stockMovement.create({
          data: {
            type: StockMovementType.IN,
            productId,
            qty: delta,
            toWarehouseId: warehouseId,
            reason: movementReason,
          },
        });
      } else {
        await tx.stockMovement.create({
          data: {
            type: StockMovementType.OUT,
            productId,
            qty: Math.abs(delta),
            fromWarehouseId: warehouseId,
            reason: movementReason,
          },
        });
      }

      return tx.stock.update({
        where: { warehouseId_productId: { warehouseId, productId } },
        data: { qty: safeQty },
        include: {
          product: {
            include: {
              productType: true,
              productCategory: true,
              measurementUnit: true,
            },
          },
        },
      });
    });
  }

  async removeStockItem(warehouseId: string, productId: string, reason?: string) {
    const [warehouse, existing] = await Promise.all([
      this.prisma.warehouse.findUnique({
        where: { id: warehouseId },
        select: { id: true, active: true },
      }),
      this.prisma.stock.findUnique({
        where: { warehouseId_productId: { warehouseId, productId } },
        select: { id: true, qty: true },
      }),
    ]);

    if (!warehouse || !warehouse.active) {
      throw new NotFoundException("Almacén no encontrado o inactivo.");
    }
    if (!existing) {
      throw new NotFoundException("No existe stock de este producto en el almacén.");
    }

    const removedQty = Number(existing.qty);
    const movementReason = `ELIMINAR_STOCK:${(reason || "Eliminación manual desde stock").trim()}`;

    return this.prisma.$transaction(async (tx) => {
      if (removedQty > 0) {
        await tx.stockMovement.create({
          data: {
            type: StockMovementType.OUT,
            productId,
            qty: removedQty,
            fromWarehouseId: warehouseId,
            reason: movementReason,
          },
        });
      }

      await tx.stock.delete({
        where: { warehouseId_productId: { warehouseId, productId } },
      });

      return {
        ok: true,
        warehouseId,
        productId,
        removedQty,
      };
    });
  }
}
