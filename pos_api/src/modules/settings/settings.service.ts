import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { dec } from "../../common/decimal";
import { CurrencyCode, Prisma } from "@prisma/client";

type SystemCurrencyCode = CurrencyCode;

type SystemSettingsPayload = Partial<{
  defaultCurrency: SystemCurrencyCode;
  enabledCurrencies: SystemCurrencyCode[];
  exchangeRateUsdToCup: number;
}>;

@Injectable()
export class SettingsService {
  private readonly systemSettingsId = "default";
  private readonly supportedCurrencies: SystemCurrencyCode[] = ["CUP", "USD"];

  constructor(private prisma: PrismaService) {}

  async getSystemSettings() {
    let settings = await this.prisma.systemSettings.findUnique({
      where: { id: this.systemSettingsId },
    });

    if (!settings) {
      settings = await this.prisma.systemSettings.create({
        data: {
          id: this.systemSettingsId,
          defaultCurrency: "CUP",
          enabledCurrencies: ["CUP", "USD"],
          exchangeRateUsdToCup: dec("1"),
        },
      });
    }

    await this.ensureInitialExchangeRateRecord(settings.exchangeRateUsdToCup);
    return settings;
  }

  async saveSystemSettings(payload: SystemSettingsPayload) {
    const current = await this.getSystemSettings();

    const enabledCurrencies = this.normalizeEnabledCurrencies(
      payload.enabledCurrencies ?? (current.enabledCurrencies as SystemCurrencyCode[]),
    );
    const defaultCurrency = (payload.defaultCurrency ?? current.defaultCurrency) as SystemCurrencyCode;

    if (!enabledCurrencies.includes(defaultCurrency)) {
      throw new BadRequestException("La moneda por defecto debe estar habilitada.");
    }

    const exchangeRateUsdToCup = payload.exchangeRateUsdToCup ?? Number(current.exchangeRateUsdToCup);
    if (!Number.isFinite(exchangeRateUsdToCup) || exchangeRateUsdToCup <= 0) {
      throw new BadRequestException("La tasa de cambio debe ser mayor a 0.");
    }

    const rateDecimal = dec(exchangeRateUsdToCup.toString());
    const hasRateChanged = !dec(current.exchangeRateUsdToCup).equals(rateDecimal);

    const settings = await this.prisma.systemSettings.upsert({
      where: { id: this.systemSettingsId },
      create: {
        id: this.systemSettingsId,
        defaultCurrency,
        enabledCurrencies,
        exchangeRateUsdToCup: rateDecimal,
      },
      update: {
        defaultCurrency,
        enabledCurrencies,
        exchangeRateUsdToCup: rateDecimal,
      },
    });

    if (hasRateChanged) {
      await this.prisma.exchangeRateRecord.create({
        data: {
          baseCurrency: "USD",
          quoteCurrency: "CUP",
          rate: rateDecimal,
          source: "SYSTEM_SETTINGS",
        },
      });
    } else {
      await this.ensureInitialExchangeRateRecord(rateDecimal);
    }

    return settings;
  }

  async listExchangeRates(limit = 50) {
    const effectiveLimit = Number.isFinite(limit) ? Math.max(1, Math.min(500, Math.floor(limit))) : 50;
    return this.prisma.exchangeRateRecord.findMany({
      orderBy: { createdAt: "desc" },
      take: effectiveLimit,
    });
  }

  async getCurrentUsdToCupRateSnapshot(tx?: Prisma.TransactionClient) {
    const prisma = tx || this.prisma;
    let settings = await prisma.systemSettings.findUnique({
      where: { id: this.systemSettingsId },
    });

    if (!settings) {
      settings = await prisma.systemSettings.create({
        data: {
          id: this.systemSettingsId,
          defaultCurrency: "CUP",
          enabledCurrencies: ["CUP", "USD"],
          exchangeRateUsdToCup: dec("1"),
        },
      });
    }

    let rateRecord = await prisma.exchangeRateRecord.findFirst({
      where: {
        baseCurrency: "USD",
        quoteCurrency: "CUP",
      },
      orderBy: { createdAt: "desc" },
    });

    if (!rateRecord) {
      rateRecord = await prisma.exchangeRateRecord.create({
        data: {
          baseCurrency: "USD",
          quoteCurrency: "CUP",
          rate: settings.exchangeRateUsdToCup,
          source: "SYSTEM_SETTINGS",
        },
      });
    }

    return {
      rateRecordId: rateRecord.id,
      rate: Number(rateRecord.rate),
    };
  }

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
    denominations: Array<number | { value: number; enabled?: boolean; currency?: string }>;
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
    if (payload.denominations !== undefined) {
      const systemSettings = await this.getSystemSettings();
      const enabledCurrencies = this.normalizeEnabledCurrencies(systemSettings.enabledCurrencies as string[]);
      const defaultCurrency = this.normalizeSupportedCurrency(settings.currency, "CUP");
      const denominations = this.normalizeDenominations(payload.denominations, { defaultCurrency, enabledCurrencies });
      await this.prisma.denomination.deleteMany({
        where: { registerSettingsId: settings.id },
      });
      if (denominations.length > 0) {
        await this.prisma.denomination.createMany({
          data: denominations.map((d) => ({
            registerSettingsId: settings.id,
            value: dec(d.value.toString()),
            enabled: d.enabled,
            currency: d.currency,
          })),
        });
      }
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

  listDenominations(filters?: { registerId?: string; currency?: string }) {
    const where: Prisma.DenominationWhereInput = {};

    if (filters?.registerId) {
      where.registerSettings = { is: { registerId: filters.registerId } };
    }

    if (filters?.currency) {
      where.currency = this.normalizeSupportedCurrency(filters.currency, "CUP");
    }

    return this.prisma.denomination.findMany({
      where,
      orderBy: [{ currency: "asc" }, { value: "asc" }],
    });
  }

  async saveDenominations(payload: { value: number; enabled: boolean; currency?: string }[]) {
    const denominations = this.normalizeDenominations(payload, {
      defaultCurrency: "CUP",
      enabledCurrencies: this.supportedCurrencies,
    });
    // Delete all and recreate
    await this.prisma.denomination.deleteMany();
    return this.prisma.denomination.createMany({
      data: denominations.map((d) => ({
        value: dec(d.value.toString()),
        enabled: d.enabled,
        currency: d.currency,
      })),
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

  private normalizeDenominations(
    input: Array<number | { value: number; enabled?: boolean; currency?: string }>,
    options: { defaultCurrency: SystemCurrencyCode; enabledCurrencies: SystemCurrencyCode[] },
  ) {
    const map = new Map<string, { value: number; enabled: boolean; currency: SystemCurrencyCode }>();

    for (const item of input) {
      const rawValue = typeof item === "number" ? item : Number(item.value);
      const enabled = typeof item === "number" ? true : item.enabled !== false;
      const currency = this.resolveDenominationCurrency(
        typeof item === "number" ? undefined : item.currency,
        options.defaultCurrency,
        options.enabledCurrencies,
      );

      if (!Number.isFinite(rawValue)) {
        throw new BadRequestException("Denominación inválida.");
      }

      const value = Number(rawValue.toFixed(2));
      if (value <= 0) {
        throw new BadRequestException("Las denominaciones deben ser mayores a 0.");
      }

      map.set(`${currency}:${value}`, { value, enabled, currency });
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.currency === b.currency) return a.value - b.value;
      return a.currency.localeCompare(b.currency);
    });
  }

  private normalizeEnabledCurrencies(input: string[]) {
    const normalized = Array.from(
      new Set(
        (input || [])
          .map((item) => item?.trim().toUpperCase())
          .filter((item): item is SystemCurrencyCode => this.supportedCurrencies.includes(item as SystemCurrencyCode)),
      ),
    ) as SystemCurrencyCode[];

    if (normalized.length === 0) {
      throw new BadRequestException("Debe habilitar al menos una moneda.");
    }

    return normalized;
  }

  private normalizeSupportedCurrency(input: string | undefined | null, fallback: SystemCurrencyCode): SystemCurrencyCode {
    const raw = (input || "").trim().toUpperCase();
    if (this.supportedCurrencies.includes(raw as SystemCurrencyCode)) {
      return raw as SystemCurrencyCode;
    }
    return fallback;
  }

  private resolveDenominationCurrency(
    currencyInput: string | undefined,
    defaultCurrency: SystemCurrencyCode,
    enabledCurrencies: SystemCurrencyCode[],
  ): SystemCurrencyCode {
    let normalized = defaultCurrency;
    if (currencyInput) {
      const raw = currencyInput.trim().toUpperCase();
      if (!this.supportedCurrencies.includes(raw as SystemCurrencyCode)) {
        throw new BadRequestException(`Moneda ${raw} no soportada para denominaciones.`);
      }
      normalized = raw as SystemCurrencyCode;
    }

    if (!enabledCurrencies.includes(normalized)) {
      throw new BadRequestException(`La moneda ${normalized} no está habilitada en configuración general.`);
    }

    return normalized;
  }

  private async ensureInitialExchangeRateRecord(rate: Prisma.Decimal | number | string) {
    const existing = await this.prisma.exchangeRateRecord.findFirst({
      where: {
        baseCurrency: "USD",
        quoteCurrency: "CUP",
      },
      orderBy: { createdAt: "desc" },
    });

    if (existing) return;

    await this.prisma.exchangeRateRecord.create({
      data: {
        baseCurrency: "USD",
        quoteCurrency: "CUP",
        rate: dec(rate),
        source: "SYSTEM_SETTINGS",
      },
    });
  }
}
