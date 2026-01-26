import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { dec } from "../../common/decimal";

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getRegisterSettings(registerId: string) {
    // First check if register exists
    const register = await this.prisma.register.findUnique({
      where: { id: registerId },
    });
    if (!register) {
      throw new Error('Register not found');
    }

    const settings = await this.prisma.registerSettings.findUnique({
      where: { registerId },
      include: {
        paymentMethods: true,
        denominations: true,
        warehouse: true,
      },
    });
    if (!settings) {
      // Create default settings
      return this.createDefaultRegisterSettings(registerId);
    }
    return settings;
  }

  async saveRegisterSettings(registerId: string, payload: Partial<{
    defaultOpeningFloat: number;
    currency: string;
    warehouseId: string;
    paymentMethods: string[];
    denominations: number[];
  }>) {
    const data: any = {};
    if (payload.defaultOpeningFloat !== undefined) {
      data.defaultOpeningFloat = dec(payload.defaultOpeningFloat.toString());
    }
    if (payload.currency !== undefined) {
      data.currency = payload.currency;
    }
    if (payload.warehouseId !== undefined && payload.warehouseId !== null && payload.warehouseId !== '') {
      data.warehouseId = payload.warehouseId;
    } else {
      data.warehouseId = null;
    }

    const settings = await this.prisma.registerSettings.upsert({
      where: { registerId },
      update: data,
      create: {
        registerId,
        defaultOpeningFloat: dec((payload.defaultOpeningFloat || 0).toString()),
        currency: payload.currency || 'USD',
        warehouseId: payload.warehouseId,
      },
      include: {
        paymentMethods: true,
        denominations: true,
      },
    });

    // Update payment methods
    if (payload.paymentMethods) {
      await this.prisma.paymentMethodSetting.deleteMany({
        where: { registerSettingsId: settings.id },
      });
      await this.prisma.paymentMethodSetting.createMany({
        data: payload.paymentMethods.map(code => ({
          registerSettingsId: settings.id,
          code,
          name: this.getPaymentMethodName(code),
          enabled: true,
        })),
      });
    }

    // Update denominations
    if (payload.denominations) {
      await this.prisma.denomination.deleteMany({
        where: { registerSettingsId: settings.id },
      });
      await this.prisma.denomination.createMany({
        data: payload.denominations.map(value => ({
          registerSettingsId: settings.id,
          value: dec(value.toString()),
          enabled: true,
        })),
      });
    }

    return this.prisma.registerSettings.findUnique({
      where: { registerId },
      include: {
        paymentMethods: true,
        denominations: true,
      },
    });
  }

  private getPaymentMethodName(code: string): string {
    const names: Record<string, string> = {
      'EFECTIVO': 'Efectivo',
      'TRANSFERENCIA': 'Transferencia',
      'TARJETA': 'Tarjeta',
    };
    return names[code] || code;
  }

  listPaymentMethods() {
    return this.prisma.paymentMethodSetting.findMany({
      orderBy: { code: 'asc' },
    });
  }

  async savePaymentMethods(payload: { code: string; name: string; enabled: boolean }[]) {
    // Delete all and recreate
    await this.prisma.paymentMethodSetting.deleteMany();
    return this.prisma.paymentMethodSetting.createMany({
      data: payload,
    });
  }

  listDenominations() {
    return this.prisma.denomination.findMany({
      orderBy: { value: 'asc' },
    });
  }

  async saveDenominations(payload: { value: number; enabled: boolean }[]) {
    // Delete all and recreate
    await this.prisma.denomination.deleteMany();
    return this.prisma.denomination.createMany({
      data: payload.map(d => ({ value: dec(d.value.toString()), enabled: d.enabled })),
    });
  }

  private async createDefaultRegisterSettings(registerId: string) {
    return this.prisma.registerSettings.create({
      data: {
        registerId,
        defaultOpeningFloat: dec('0'),
      },
      include: {
        paymentMethods: true,
        denominations: true,
      },
    });
  }
}