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
      include: {
        productType: true,
        productCategory: true,
        measurementUnit: true,
      },
    });
  }

  create(dto: { name: string; codigo?: string; barcode?: string; price: string; cost?: string; image?: string; productTypeId?: string; productCategoryId?: string; measurementUnitId?: string }) {
    return this.prisma.product.create({
      data: {
        name: dto.name,
        codigo: dto.codigo,
        barcode: dto.barcode,
        price: dec(dto.price) as any,
        cost: dto.cost ? dec(dto.cost) as any : undefined,
        image: dto.image,
        productTypeId: dto.productTypeId,
        productCategoryId: dto.productCategoryId,
        measurementUnitId: dto.measurementUnitId,
      },
    });
  }

  update(id: string, dto: { name?: string; codigo?: string; barcode?: string; price?: string; cost?: string; image?: string; active?: boolean; productTypeId?: string; productCategoryId?: string; measurementUnitId?: string }) {
    return this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        codigo: dto.codigo,
        barcode: dto.barcode,
        price: dto.price ? dec(dto.price) as any : undefined,
        cost: dto.cost ? dec(dto.cost) as any : undefined,
        image: dto.image,
        active: dto.active,
        productTypeId: dto.productTypeId,
        productCategoryId: dto.productCategoryId,
        measurementUnitId: dto.measurementUnitId,
      },
    });
  }

  findOne(id: string) {
    return this.prisma.product.findUnique({
      where: { id },
      include: {
        productType: true,
        productCategory: true,
        measurementUnit: true,
      },
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
