import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProductTypesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.productType.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
  }

  findOne(id: string) {
    return this.prisma.productType.findUnique({
      where: { id },
      include: { products: true },
    });
  }

  create(data: { name: string; description?: string }) {
    return this.prisma.productType.create({
      data: {
        name: data.name,
        description: data.description,
      },
    });
  }

  update(id: string, data: { name?: string; description?: string; active?: boolean }) {
    return this.prisma.productType.update({
      where: { id },
      data,
    });
  }

  delete(id: string) {
    return this.prisma.productType.update({
      where: { id },
      data: { active: false },
    });
  }
}
