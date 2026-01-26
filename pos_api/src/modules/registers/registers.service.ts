import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { dec } from "../../common/decimal";

@Injectable()
export class RegistersService {
  constructor(private prisma: PrismaService) {}

  listActive() {
    return this.prisma.register.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    });
  }

  async create(dto: { name: string; code?: string }) {
    const data: any = { name: dto.name };
    if (dto.code) {
      data.code = dto.code;
    }

    const register = await this.prisma.register.create({ data });

    // Create associated warehouse
    const warehouse = await this.prisma.warehouse.create({
      data: {
        name: `Almacén ${dto.name}`,
        code: `WH_${register.id}`,
        type: 'TPV',
        registerId: register.id,
      },
    });

    // Update register settings with warehouseId
    await this.prisma.registerSettings.upsert({
      where: { registerId: register.id },
      update: { warehouseId: warehouse.id },
      create: {
        registerId: register.id,
        warehouseId: warehouse.id,
        defaultOpeningFloat: dec('0'),
        currency: 'CUP',
      },
    });

    return register;
  }

  async update(id: string, dto: { name: string; code?: string }) {
    const data: any = { name: dto.name };
    if (dto.code) {
      data.code = dto.code;
    }

    return this.prisma.register.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    // Delete associated warehouse first (cascade delete should handle this, but being explicit)
    await this.prisma.warehouse.deleteMany({
      where: { registerId: id },
    });

    // Delete register settings
    await this.prisma.registerSettings.deleteMany({
      where: { registerId: id },
    });

    // Delete the register
    return this.prisma.register.delete({
      where: { id },
    });
  }
}
