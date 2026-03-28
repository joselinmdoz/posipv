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
const accounting_service_1 = require("../accounting/accounting.service");
let SalesService = class SalesService {
    constructor(prisma, accountingService) {
        this.prisma = prisma;
        this.accountingService = accountingService;
    }
    async listSessionProducts(cashSessionId) {
        const session = await this.prisma.cashSession.findUnique({
            where: { id: cashSessionId },
            include: {
                register: {
                    include: {
                        warehouse: true,
                        settings: {
                            include: {
                                paymentMethods: true,
                            },
                        },
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
        const registerCurrency = this.resolveRegisterCurrency(session.register.settings?.currency);
        const stock = await this.prisma.stock.findMany({
            where: {
                warehouseId: session.register.warehouse.id,
                qty: { gt: 0 },
                product: {
                    active: true,
                    currency: registerCurrency,
                },
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
            qtyAvailable: Number(item.qty),
        }));
    }
    async createSale(cashierId, dto) {
        const session = await this.prisma.cashSession.findUnique({
            where: { id: dto.cashSessionId },
            include: {
                register: {
                    include: {
                        warehouse: true,
                        settings: {
                            include: {
                                paymentMethods: true,
                            },
                        },
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
        const customer = await this.resolveCustomer(dto.customerId, dto.customerName);
        const tpvWarehouseId = session.register.warehouse.id;
        const registerCurrency = this.resolveRegisterCurrency(session.register.settings?.currency);
        const paymentMethodRules = await this.resolvePaymentMethodRulesForSale(session.register.settings?.paymentMethods || []);
        await this.assertCashierAllowedForRegister(session.registerId, cashierId, session.register.settings?.sellerEmployeeIds || []);
        if (!dto.items?.length)
            throw new common_1.BadRequestException("Sin items.");
        if (!dto.payments?.length)
            throw new common_1.BadRequestException("Sin pagos.");
        const normalizedItems = dto.items.map((item) => ({
            productId: item.productId,
            qty: this.parsePositiveQty(item.qty),
        }));
        const qtyByProduct = new Map();
        for (const item of normalizedItems) {
            const currentQty = qtyByProduct.get(item.productId) || 0;
            qtyByProduct.set(item.productId, Number((currentQty + item.qty).toFixed(6)));
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
        if (stockRows.some((row) => row.product.currency !== registerCurrency)) {
            throw new common_1.BadRequestException(`El TPV está configurado en ${registerCurrency}. Solo puede vender productos en esa moneda.`);
        }
        const stockByProduct = new Map(stockRows.map((s) => [s.productId, s]));
        const productById = new Map(stockRows.map((s) => [s.productId, s.product]));
        for (const item of normalizedItems) {
            const product = productById.get(item.productId);
            if (!product) {
                throw new common_1.BadRequestException("Producto inválido.");
            }
            if (!product.allowFractionalQty && !Number.isInteger(item.qty)) {
                throw new common_1.BadRequestException(`El producto "${product.name}" no permite cantidades fraccionadas.`);
            }
        }
        for (const [productId, requestedQty] of qtyByProduct.entries()) {
            const stock = stockByProduct.get(productId);
            if (!stock || Number(stock.qty) < requestedQty) {
                throw new common_1.BadRequestException("Stock insuficiente para completar la venta.");
            }
        }
        const priceMap = new Map(stockRows.map((s) => [s.productId, s.product.price]));
        let total = new client_1.Prisma.Decimal(0);
        const itemsData = normalizedItems.map((i) => {
            const price = priceMap.get(i.productId);
            const product = productById.get(i.productId);
            if (!price || !product)
                throw new common_1.BadRequestException("Producto inválido.");
            total = total.add(price.mul(i.qty));
            return {
                productId: i.productId,
                qty: i.qty,
                price: price,
                costSnapshot: product.cost ?? null,
            };
        });
        const normalizedPayments = dto.payments.map((rawPayment) => {
            const method = this.normalizePaymentMethod(rawPayment.method);
            const methodRule = paymentMethodRules.get(method);
            if (!methodRule || methodRule.enabled !== true) {
                throw new common_1.BadRequestException(`El método de pago ${method} no está habilitado para este TPV.`);
            }
            const transactionCode = this.normalizeTransactionCode(rawPayment.transactionCode);
            if (methodRule.requiresTransactionCode && !transactionCode) {
                throw new common_1.BadRequestException(`El método ${method} requiere código de transacción.`);
            }
            const currency = this.normalizeCurrency(rawPayment.currency);
            if (currency !== registerCurrency) {
                throw new common_1.BadRequestException(`El TPV está configurado en ${registerCurrency}. Todos los pagos deben registrarse en esa moneda.`);
            }
            const rawAmountOriginal = rawPayment.amountOriginal ?? rawPayment.amount;
            const amountOriginal = this.parsePositiveAmount(rawAmountOriginal, "Monto de pago inválido.");
            return {
                method,
                currency,
                amountOriginal,
                amount: amountOriginal,
                transactionCode,
                exchangeRateUsdToCup: null,
                exchangeRateRecordId: null,
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
                    warehouseId: tpvWarehouseId,
                    channel: client_1.SaleChannel.TPV,
                    customerId: customer?.id || null,
                    customerName: customer?.name || null,
                    documentNumber: await this.generateDocumentNumber(tx, client_1.SaleChannel.TPV),
                    total: total,
                    items: { create: itemsData },
                    payments: {
                        create: normalizedPayments.map((p) => ({
                            method: p.method,
                            amount: (0, decimal_1.dec)(p.amount),
                            currency: p.currency,
                            amountOriginal: (0, decimal_1.dec)(p.amountOriginal),
                            transactionCode: p.transactionCode || null,
                            exchangeRateUsdToCup: null,
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
            await this.accountingService.postAutomatedSaleEntries(tx, sale.id, cashierId);
            return sale;
        });
    }
    async deleteSale(saleId, deletedByUserId) {
        const sale = await this.prisma.sale.findUnique({
            where: { id: saleId },
            include: {
                items: true,
                payments: true,
            },
        });
        if (!sale)
            throw new common_1.NotFoundException("Venta no encontrada.");
        return this.prisma.$transaction(async (tx) => {
            let restockedQty = 0;
            let restockedProducts = 0;
            if (sale.status === client_1.SaleStatus.PAID) {
                if (!sale.warehouseId) {
                    throw new common_1.BadRequestException("La venta no tiene almacén asociado para revertir stock.");
                }
                const qtyByProduct = new Map();
                for (const item of sale.items) {
                    qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) || 0) + Number(item.qty));
                }
                for (const [productId, qty] of qtyByProduct.entries()) {
                    await tx.stock.upsert({
                        where: {
                            warehouseId_productId: {
                                warehouseId: sale.warehouseId,
                                productId,
                            },
                        },
                        create: {
                            warehouseId: sale.warehouseId,
                            productId,
                            qty,
                        },
                        update: {
                            qty: { increment: qty },
                        },
                    });
                    await tx.stockMovement.create({
                        data: {
                            type: client_1.StockMovementType.IN,
                            productId,
                            qty,
                            toWarehouseId: sale.warehouseId,
                            reason: `ELIMINACION_VENTA:${sale.documentNumber || sale.id}:${deletedByUserId}`,
                        },
                    });
                    restockedQty += qty;
                    restockedProducts += 1;
                }
            }
            await this.accountingService.voidAutomatedSaleEntries(tx, sale.id, `ELIMINACION_VENTA:${sale.documentNumber || sale.id}:${deletedByUserId}`);
            await tx.payment.deleteMany({ where: { saleId: sale.id } });
            await tx.saleItem.deleteMany({ where: { saleId: sale.id } });
            await tx.sale.delete({ where: { id: sale.id } });
            return {
                ok: true,
                deletedSaleId: sale.id,
                restockedProducts,
                restockedQty,
            };
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
    normalizePaymentMethod(methodInput) {
        const raw = String(methodInput || "").trim().toUpperCase();
        switch (raw) {
            case client_1.PaymentMethod.CASH:
            case client_1.PaymentMethod.CARD:
            case client_1.PaymentMethod.TRANSFER:
            case client_1.PaymentMethod.OTHER:
                return raw;
            default:
                throw new common_1.BadRequestException("Método de pago inválido.");
        }
    }
    normalizePaymentMethodCode(codeInput) {
        const raw = String(codeInput || "").trim().toUpperCase();
        switch (raw) {
            case "CASH":
            case "EFECTIVO":
                return client_1.PaymentMethod.CASH;
            case "CARD":
            case "TARJETA":
                return client_1.PaymentMethod.CARD;
            case "TRANSFER":
            case "TRANSFERENCIA":
                return client_1.PaymentMethod.TRANSFER;
            case "OTHER":
            case "OTRO":
                return client_1.PaymentMethod.OTHER;
            default:
                return null;
        }
    }
    normalizeTransactionCode(value) {
        const normalized = String(value || "").trim();
        if (!normalized)
            return null;
        return normalized.slice(0, 120);
    }
    async resolvePaymentMethodRulesForSale(registerPaymentMethods) {
        const fromRegister = this.buildPaymentMethodRules(registerPaymentMethods);
        if (fromRegister.size > 0)
            return fromRegister;
        const globalMethods = await this.prisma.paymentMethodSetting.findMany({
            where: { enabled: true },
            select: {
                code: true,
                enabled: true,
                requiresTransactionCode: true,
            },
        });
        const fromGlobal = this.buildPaymentMethodRules(globalMethods);
        if (fromGlobal.size > 0)
            return fromGlobal;
        return new Map([
            [client_1.PaymentMethod.CASH, { enabled: true, requiresTransactionCode: false }],
            [client_1.PaymentMethod.CARD, { enabled: true, requiresTransactionCode: false }],
            [client_1.PaymentMethod.TRANSFER, { enabled: true, requiresTransactionCode: false }],
            [client_1.PaymentMethod.OTHER, { enabled: false, requiresTransactionCode: false }],
        ]);
    }
    buildPaymentMethodRules(rows) {
        const map = new Map();
        for (const row of rows || []) {
            if (row.enabled === false)
                continue;
            const method = this.normalizePaymentMethodCode(row.code);
            if (!method)
                continue;
            map.set(method, {
                enabled: true,
                requiresTransactionCode: row.requiresTransactionCode === true,
            });
        }
        return map;
    }
    normalizeCustomerName(input) {
        const value = (input || "").trim();
        return value.length ? value : null;
    }
    async resolveCustomer(customerId, fallbackCustomerName) {
        const normalizedCustomerId = (customerId || "").trim();
        if (normalizedCustomerId.length) {
            const customer = await this.prisma.client.findUnique({
                where: { id: normalizedCustomerId },
                select: {
                    id: true,
                    name: true,
                    active: true,
                },
            });
            if (!customer || !customer.active) {
                throw new common_1.BadRequestException("El cliente seleccionado no existe o está inactivo.");
            }
            return customer;
        }
        const fallbackName = this.normalizeCustomerName(fallbackCustomerName);
        if (!fallbackName)
            return null;
        return {
            id: null,
            name: fallbackName,
            active: true,
        };
    }
    resolveRegisterCurrency(currencyInput) {
        const raw = (currencyInput || "CUP").toString().trim().toUpperCase();
        if (raw === client_1.CurrencyCode.CUP)
            return client_1.CurrencyCode.CUP;
        if (raw === client_1.CurrencyCode.USD)
            return client_1.CurrencyCode.USD;
        return client_1.CurrencyCode.CUP;
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
    parsePositiveQty(input) {
        const value = Number(input);
        if (!Number.isFinite(value) || value <= 0) {
            throw new common_1.BadRequestException("Cantidad inválida. Debe ser mayor a 0.");
        }
        return Number(value.toFixed(6));
    }
    async generateDocumentNumber(tx, channel) {
        const prefix = channel === client_1.SaleChannel.TPV ? "TPV" : "DIR";
        for (let attempt = 0; attempt < 5; attempt++) {
            const now = new Date();
            const stamp = [
                now.getFullYear(),
                `${now.getMonth() + 1}`.padStart(2, "0"),
                `${now.getDate()}`.padStart(2, "0"),
                `${now.getHours()}`.padStart(2, "0"),
                `${now.getMinutes()}`.padStart(2, "0"),
                `${now.getSeconds()}`.padStart(2, "0"),
            ].join("");
            const suffix = Math.floor(Math.random() * 900 + 100).toString();
            const candidate = `${prefix}-${stamp}-${suffix}`;
            const existing = await tx.sale.findUnique({
                where: { documentNumber: candidate },
                select: { id: true },
            });
            if (!existing)
                return candidate;
        }
        throw new common_1.BadRequestException("No se pudo generar un número de comprobante único.");
    }
    async assertCashierAllowedForRegister(registerId, userId, configuredEmployeeIds) {
        const allowedEmployeeIds = Array.isArray(configuredEmployeeIds) ? configuredEmployeeIds : [];
        if (allowedEmployeeIds.length === 0) {
            return;
        }
        const employee = await this.prisma.employee.findFirst({
            where: {
                userId,
                active: true,
            },
            select: {
                id: true,
            },
        });
        if (!employee || !allowedEmployeeIds.includes(employee.id)) {
            throw new common_1.BadRequestException("Este cajero no está autorizado para vender en el TPV seleccionado.");
        }
    }
};
exports.SalesService = SalesService;
exports.SalesService = SalesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        accounting_service_1.AccountingService])
], SalesService);
//# sourceMappingURL=sales.service.js.map