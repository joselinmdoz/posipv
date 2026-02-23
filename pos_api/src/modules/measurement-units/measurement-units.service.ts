import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MeasurementUnitsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.measurementUnit.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      include: { type: true },
    });
  }

  findOne(id: string) {
    return this.prisma.measurementUnit.findUnique({
      where: { id },
      include: { type: true, products: true },
    });
  }

  create(data: { name: string; symbol: string; typeId?: string }) {
    return this.prisma.measurementUnit.create({
      data: {
        name: data.name,
        symbol: data.symbol,
        typeId: data.typeId,
      },
      include: { type: true },
    });
  }

  update(id: string, data: { name?: string; symbol?: string; typeId?: string; active?: boolean }) {
    return this.prisma.measurementUnit.update({
      where: { id },
      data,
      include: { type: true },
    });
  }

  delete(id: string) {
    return this.prisma.measurementUnit.update({
      where: { id },
      data: { active: false },
    });
  }
}
