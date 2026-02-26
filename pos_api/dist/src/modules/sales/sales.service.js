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
exports.SalesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const client_1 = require("@prisma/client");
const decimal_1 = require("../../common/decimal");
const settings_service_1 = require("../settings/settings.service");
let SalesService = class SalesService {
    constructor(prisma, settingsService) {
        this.prisma = prisma;
        this.settingsService = settingsService;
    }
    async listSessionProducts(cashSessionId) {
        const session = await this.prisma.cashSession.findUnique({
            where: { id: cashSessionId },
            include: {
                register: {
                    include: {
                        warehouse: true,
                    },
                },
            },
        });
        if (!session)
            throw new common_1.NotFoundException("Sesión de caja no existe.");
        if (session.status !== client_1.CashSessionStatus.OPEN)
            throw new common_1.BadRequestException("La sesión no está abierta.");
        if (!session.register.warehouse?.id) {
            throw new common_1.BadRequestException("El TPV no tiene almacén asociado.");
        }
        const stock = await this.prisma.stock.findMany({
            where: {
                warehouseId: session.register.warehouse.id,
                qty: { gt: 0 },
                product: { active: true },
            },
            include: {
                product: {
                    include: {
                        productType: true,
                        productCategory: true,
                        measurementUnit: true,
                    },
                },
            },
            orderBy: { product: { name: "asc" } },
        });
        return stock.map((item) => ({
            ...item.product,
            qtyAvailable: item.qty,
        }));
    }
    async createSale(cashierId, dto) {
        const session = await this.prisma.cashSession.findUnique({
            where: { id: dto.cashSessionId },
            include: {
                register: {
                    include: {
                        warehouse: true,
                    },
                },
            },
        });
        if (!session)
            throw new common_1.NotFoundException("Sesión de caja no existe.");
        if (session.status !== client_1.CashSessionStatus.OPEN)
            throw new common_1.BadRequestException("La sesión no está abierta.");
        if (!session.register.warehouse?.id) {
            throw new common_1.BadRequestException("El TPV no tiene almacén asociado.");
        }
        const tpvWarehouseId = session.register.warehouse.id;
        if (!dto.items?.length)
            throw new common_1.BadRequestException("Sin items.");
        if (!dto.payments?.length)
            throw new common_1.BadRequestException("Sin pagos.");
        const rateSnapshot = await this.settingsService.getCurrentUsdToCupRateSnapshot();
        const qtyByProduct = new Map();
        for (const item of dto.items) {
            const currentQty = qtyByProduct.get(item.productId) || 0;
            qtyByProduct.set(item.productId, currentQty + item.qty);
        }
        const productIds = Array.from(qtyByProduct.keys());
        const stockRows = await this.prisma.stock.findMany({
            where: {
                warehouseId: tpvWarehouseId,
                productId: { in: productIds },
                product: { active: true },
            },
            include: {
                product: true,
            },
        });
        if (stockRows.length !== productIds.length) {
            throw new common_1.BadRequestException("Hay productos inválidos, inactivos o sin stock en el TPV.");
        }
        const stockByProduct = new Map(stockRows.map((s) => [s.productId, s]));
        for (const [productId, requestedQty] of qtyByProduct.entries()) {
            const stock = stockByProduct.get(productId);
            if (!stock || stock.qty < requestedQty) {
                throw new common_1.BadRequestException("Stock insuficiente para completar la venta.");
            }
        }
        const priceMap = new Map(stockRows.map((s) => [s.productId, s.product.price]));
        let total = new client_1.Prisma.Decimal(0);
        const itemsData = dto.items.map((i) => {
            const price = priceMap.get(i.productId);
            if (!price)
                throw new common_1.BadRequestException("Producto inválido.");
            total = total.add(price.mul(i.qty));
            return { productId: i.productId, qty: i.qty, price: price };
        });
        const normalizedPayments = dto.payments.map((rawPayment) => {
            const currency = this.normalizeCurrency(rawPayment.currency);
            const rawAmountOriginal = rawPayment.amountOriginal ?? rawPayment.amount;
            const amountOriginal = this.parsePositiveAmount(rawAmountOriginal, "Monto de pago inválido.");
            let amountBase = amountOriginal;
            const exchangeRateUsdToCup = (0, decimal_1.dec)(rateSnapshot.rate.toString());
            if (currency === client_1.CurrencyCode.USD) {
                amountBase = (0, decimal_1.dec)(amountOriginal.mul(exchangeRateUsdToCup).toFixed(2));
            }
            return {
                method: rawPayment.method,
                currency,
                amountOriginal,
                amount: amountBase,
                exchangeRateUsdToCup,
                exchangeRateRecordId: rateSnapshot.rateRecordId,
            };
        });
        const paySum = normalizedPayments.reduce((acc, p) => acc.add((0, decimal_1.dec)(p.amount)), new client_1.Prisma.Decimal(0));
        if (!(0, decimal_1.moneyEq)(total, paySum)) {
            throw new common_1.BadRequestException(`Pagos (${paySum.toFixed(2)}) no cuadran con total (${total.toFixed(2)}).`);
        }
        return this.prisma.$transaction(async (tx) => {
            const sale = await tx.sale.create({
                data: {
                    cashierId,
                    cashSessionId: session.id,
                    total: total,
                    items: { create: itemsData },
                    payments: {
                        create: normalizedPayments.map((p) => ({
                            method: p.method,
                            amount: (0, decimal_1.dec)(p.amount),
                            currency: p.currency,
                            amountOriginal: (0, decimal_1.dec)(p.amountOriginal),
                            exchangeRateUsdToCup: (0, decimal_1.dec)(p.exchangeRateUsdToCup),
                            exchangeRateRecordId: p.exchangeRateRecordId || null,
                        })),
                    },
                },
                include: { items: true, payments: true },
            });
            for (const [productId, requestedQty] of qtyByProduct.entries()) {
                const updated = await tx.stock.updateMany({
                    where: {
                        warehouseId: tpvWarehouseId,
                        productId,
                        qty: { gte: requestedQty },
                    },
                    data: {
                        qty: { decrement: requestedQty },
                    },
                });
                if (updated.count === 0) {
                    throw new common_1.BadRequestException("Stock insuficiente al confirmar la venta.");
                }
                await tx.stockMovement.create({
                    data: {
                        type: client_1.StockMovementType.OUT,
                        productId,
                        qty: requestedQty,
                        fromWarehouseId: tpvWarehouseId,
                        reason: "VENTA",
                    },
                });
            }
            return sale;
        });
    }
    normalizeCurrency(currencyInput) {
        const raw = (currencyInput || "CUP").toString().trim().toUpperCase();
        if (raw === client_1.CurrencyCode.CUP)
            return client_1.CurrencyCode.CUP;
        if (raw === client_1.CurrencyCode.USD)
            return client_1.CurrencyCode.USD;
        throw new common_1.BadRequestException("Moneda de pago inválida.");
    }
    parsePositiveAmount(input, message) {
        try {
            const value = (0, decimal_1.dec)(input);
            if (!value.isFinite() || value.lte(0)) {
                throw new common_1.BadRequestException(message);
            }
            return value;
        }
        catch {
            throw new common_1.BadRequestException(message);
        }
    }
};
exports.SalesService = SalesService;
exports.SalesService = SalesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        settings_service_1.SettingsService])
], SalesService);
//# sourceMappingURL=sales.service.js.map