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
        if (payload.denominations) {
            await this.prisma.denomination.deleteMany({
                where: { registerSettingsId: settings.id },
            });
            await this.prisma.denomination.createMany({
                data: payload.denominations.map(value => ({
                    registerSettingsId: settings.id,
                    value: (0, decimal_1.dec)(value.toString()),
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
};
exports.SettingsService = SettingsService;
exports.SettingsService = SettingsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SettingsService);
//# sourceMappingURL=settings.service.js.map