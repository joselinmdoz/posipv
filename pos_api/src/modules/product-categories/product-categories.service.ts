import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProductCategoriesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.productCategory.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
  }

  findOne(id: string) {
    return this.prisma.productCategory.findUnique({
      where: { id },
      include: { products: true },
    });
  }

  create(data: { name: string; description?: string }) {
    return this.prisma.productCategory.create({
      data: {
        name: data.name,
        description: data.description,
      },
    });
  }

  update(id: string, data: { name?: string; description?: string; active?: boolean }) {
    return this.prisma.productCategory.update({
      where: { id },
      data,
    });
  }

  delete(id: string) {
    return this.prisma.productCategory.update({
      where: { id },
      data: { active: false },
    });
  }
}
