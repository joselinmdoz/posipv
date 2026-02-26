"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const decimal_1 = require("../../common/decimal");
let SettingsService = class SettingsService {
    constructor(prisma) {
        this.prisma = prisma;
        this.systemSettingsId = "default";
        this.supportedCurrencies = ["CUP", "USD"];
    }
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
                    exchangeRateUsdToCup: (0, decimal_1.dec)("1"),
                },
            });
        }
        await this.ensureInitialExchangeRateRecord(settings.exchangeRateUsdToCup);
        return settings;
    }
    async saveSystemSettings(payload) {
        const current = await this.getSystemSettings();
        const enabledCurrencies = this.normalizeEnabledCurrencies(payload.enabledCurrencies ?? current.enabledCurrencies);
        const defaultCurrency = (payload.defaultCurrency ?? current.defaultCurrency);
        if (!enabledCurrencies.includes(defaultCurrency)) {
            throw new common_1.BadRequestException("La moneda por defecto debe estar habilitada.");
        }
        const exchangeRateUsdToCup = payload.exchangeRateUsdToCup ?? Number(current.exchangeRateUsdToCup);
        if (!Number.isFinite(exchangeRateUsdToCup) || exchangeRateUsdToCup <= 0) {
            throw new common_1.BadRequestException("La tasa de cambio debe ser mayor a 0.");
        }
        const rateDecimal = (0, decimal_1.dec)(exchangeRateUsdToCup.toString());
        const hasRateChanged = !(0, decimal_1.dec)(current.exchangeRateUsdToCup).equals(rateDecimal);
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
        }
        else {
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
    async getCurrentUsdToCupRateSnapshot(tx) {
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
                    exchangeRateUsdToCup: (0, decimal_1.dec)("1"),
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
    async getRegisterSettings(registerId) {
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
            return this.createDefaultRegisterSettings(registerId);
        }
        return settings;
    }
    async saveRegisterSettings(registerId, payload) {
        const data = {};
        if (payload.defaultOpeningFloat !== undefined) {
            data.defaultOpeningFloat = (0, decimal_1.dec)(payload.defaultOpeningFloat.toString());
        }
        if (payload.currency !== undefined) {
            data.currency = payload.currency;
        }
        if (payload.warehouseId !== undefined && payload.warehouseId !== null && payload.warehouseId !== '') {
            data.warehouseId = payload.warehouseId;
        }
        else {
            data.warehouseId = null;
        }
        const settings = await this.prisma.registerSettings.upsert({
            where: { registerId },
            update: data,
            create: {
                registerId,
                defaultOpeningFloat: (0, decimal_1.dec)((payload.defaultOpeningFloat || 0).toString()),
                currency: payload.currency || 'USD',
                warehouseId: payload.warehouseId,
            },
            include: {
                paymentMethods: true,
                denominations: true,
            },
        });
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
        if (payload.denominations !== undefined) {
            const denominations = this.normalizeDenominations(payload.denominations);
            await this.prisma.denomination.deleteMany({
                where: { registerSettingsId: settings.id },
            });
            if (denominations.length > 0) {
                await this.prisma.denomination.createMany({
                    data: denominations.map((d) => ({
                        registerSettingsId: settings.id,
                        value: (0, decimal_1.dec)(d.value.toString()),
                        enabled: d.enabled,
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
    getPaymentMethodName(code) {
        const names = {
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
    async savePaymentMethods(payload) {
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
    async saveDenominations(payload) {
        await this.prisma.denomination.deleteMany();
        return this.prisma.denomination.createMany({
            data: payload.map(d => ({ value: (0, decimal_1.dec)(d.value.toString()), enabled: d.enabled })),
        });
    }
    async createDefaultRegisterSettings(registerId) {
        return this.prisma.registerSettings.create({
            data: {
                registerId,
                defaultOpeningFloat: (0, decimal_1.dec)('0'),
            },
            include: {
                paymentMethods: true,
                denominations: true,
            },
        });
    }
    normalizeDenominations(input) {
        const map = new Map();
        for (const item of input) {
            const rawValue = typeof item === "number" ? item : Number(item.value);
            const enabled = typeof item === "number" ? true : item.enabled !== false;
            if (!Number.isFinite(rawValue)) {
                throw new common_1.BadRequestException("Denominación inválida.");
            }
            const value = Number(rawValue.toFixed(2));
            if (value <= 0) {
                throw new common_1.BadRequestException("Las denominaciones deben ser mayores a 0.");
            }
            map.set(value, { value, enabled });
        }
        return Array.from(map.values()).sort((a, b) => a.value - b.value);
    }
    normalizeEnabledCurrencies(input) {
        const normalized = Array.from(new Set((input || [])
            .map((item) => item?.trim().toUpperCase())
            .filter((item) => this.supportedCurrencies.includes(item))));
        if (normalized.length === 0) {
            throw new common_1.BadRequestException("Debe habilitar al menos una moneda.");
        }
        return normalized;
    }
    async ensureInitialExchangeRateRecord(rate) {
        const existing = await this.prisma.exchangeRateRecord.findFirst({
            where: {
                baseCurrency: "USD",
                quoteCurrency: "CUP",
            },
            orderBy: { createdAt: "desc" },
        });
        if (existing)
            return;
        await this.prisma.exchangeRateRecord.create({
            data: {
                baseCurrency: "USD",
                quoteCurrency: "CUP",
                rate: (0, decimal_1.dec)(rate),
                source: "SYSTEM_SETTINGS",
            },
        });
    }
};
exports.SettingsService = SettingsService;
exports.SettingsService = SettingsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SettingsService);
//# sourceMappingURL=settings.service.js.map