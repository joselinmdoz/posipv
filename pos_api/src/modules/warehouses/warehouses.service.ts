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
}