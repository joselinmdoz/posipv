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
}
