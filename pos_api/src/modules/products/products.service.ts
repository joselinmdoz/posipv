import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { dec } from "../../common/decimal";

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.product.findMany({
      where: { active: true },
      orderBy: { createdAt: "desc" },
    });
  }

  create(dto: { name: string; sku?: string; barcode?: string; price: string; cost?: string; unit?: string; image?: string }) {
    return this.prisma.product.create({
      data: {
        name: dto.name,
        sku: dto.sku,
        barcode: dto.barcode,
        price: dec(dto.price) as any,
        cost: dto.cost ? dec(dto.cost) as any : undefined,
        unit: dto.unit,
        image: dto.image,
      },
    });
  }

  update(id: string, dto: { name?: string; sku?: string; barcode?: string; price?: string; cost?: string; unit?: string; image?: string; active?: boolean }) {
    return this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        sku: dto.sku,
        barcode: dto.barcode,
        price: dto.price ? dec(dto.price) as any : undefined,
        cost: dto.cost ? dec(dto.cost) as any : undefined,
        unit: dto.unit,
        image: dto.image,
        active: dto.active,
      },
    });
  }

  findOne(id: string) {
    return this.prisma.product.findUnique({
      where: { id },
    });
  }

  delete(id: string) {
    // Soft delete - solo desactivamos el producto
    return this.prisma.product.update({
      where: { id },
      data: { active: false },
    });
  }
}
