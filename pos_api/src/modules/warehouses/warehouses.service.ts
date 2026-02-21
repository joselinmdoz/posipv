import { Injectable } from "@nestjs/common";
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
          select: { id: true, name: true, sku: true },
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
    // Soft delete
    return this.prisma.warehouse.update({
      where: { id },
      data: { active: false },
    });
  }
}