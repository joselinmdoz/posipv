import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MeasurementUnitTypesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.measurementUnitType.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      include: {
        measurementUnits: true,
      },
    });
  }

  findOne(id: string) {
    return this.prisma.measurementUnitType.findUnique({
      where: { id },
      include: { measurementUnits: true },
    });
  }

  create(data: { name: string; description?: string }) {
    return this.prisma.measurementUnitType.create({
      data: {
        name: data.name,
        description: data.description,
      },
    });
  }

  update(id: string, data: { name?: string; description?: string; active?: boolean }) {
    return this.prisma.measurementUnitType.update({
      where: { id },
      data,
    });
  }

  delete(id: string) {
    return this.prisma.measurementUnitType.update({
      where: { id },
      data: { active: false },
    });
  }
}
