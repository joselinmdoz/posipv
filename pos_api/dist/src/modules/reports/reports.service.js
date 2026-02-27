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
exports.ReportsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const decimal_1 = require("../../common/decimal");
let ReportsService = class ReportsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getSalesReport(startDate, endDate, filters = {}) {
        const range = this.resolveDateRange(startDate, endDate);
        const where = this.buildSalesWhere(range.start, range.end, filters);
        const sales = await this.prisma.sale.findMany({
            where,
            include: {
                items: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                name: true,
                                codigo: true,
                                barcode: true,
                                currency: true,
                            },
                        },
                    },
                },
                payments: true,
                warehouse: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                        type: true,
                    },
                },
                cashier: {
                    select: {
                        id: true,
                        email: true,
                        role: true,
                        active: true,
                        createdAt: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });
        const detailedSales = sales.map((sale) => ({
            id: sale.id,
            createdAt: sale.createdAt,
            createdAtServer: this.formatServerDateTime(sale.createdAt),
            status: sale.status,
            channel: sale.channel,
            total: Number(sale.total.toFixed(2)),
            cashierId: sale.cashierId,
            cashSessionId: sale.cashSessionId,
            warehouseId: sale.warehouseId,
            warehouse: sale.warehouse
                ? {
                    id: sale.warehouse.id,
                    name: sale.warehouse.name,
                    code: sale.warehouse.code,
                    type: sale.warehouse.type,
                }
                : null,
            customerName: sale.customerName || null,
            documentNumber: sale.documentNumber || null,
            items: sale.items.map((item) => ({
                id: item.id,
                saleId: item.saleId,
                productId: item.productId,
                qty: item.qty,
                price: Number(item.price.toFixed(2)),
                product: {
                    id: item.product.id,
                    name: item.product.name,
                    codigo: item.product.codigo,
                    barcode: item.product.barcode,
                    currency: item.product.currency,
                },
            })),
            payments: sale.payments.map((payment) => ({
                id: payment.id,
                saleId: payment.saleId,
                method: payment.method,
                amount: Number(payment.amount.toFixed(2)),
                currency: payment.currency,
                amountOriginal: Number(payment.amountOriginal.toFixed(2)),
                exchangeRateUsdToCup: payment.exchangeRateUsdToCup ? Number(payment.exchangeRateUsdToCup.toFixed(6)) : null,
                exchangeRateRecordId: payment.exchangeRateRecordId || null,
            })),
            cashier: sale.cashier,
        }));
        return {
            serverDate: range.serverDate,
            serverTimezone: range.serverTimezone,
            startDate: range.startDate,
            endDate: range.endDate,
            totalSales: sales.length,
            totalAmount: Number(sales.reduce((sum, sale) => sum.add(sale.total), (0, decimal_1.dec)(0)).toFixed(2)),
            averageTicket: sales.length > 0
                ? Number((sales.reduce((sum, sale) => sum.add(sale.total), (0, decimal_1.dec)(0)).toNumber() / sales.length).toFixed(2))
                : 0,
            salesByPaymentMethod: this.groupSalesByPaymentMethod(detailedSales),
            salesByCashier: this.groupSalesByCashier(detailedSales),
            detailedSales,
        };
    }
    buildSalesWhere(start, end, filters) {
        const where = {
            createdAt: {
                gte: start,
                lte: end,
            },
            status: { not: "VOID" },
        };
        const channel = this.parseChannelFilter(filters.channel);
        if (channel) {
            where.channel = channel;
        }
        const warehouseId = this.cleanFilter(filters.warehouseId);
        if (warehouseId) {
            where.warehouseId = warehouseId;
        }
        const cashierEmail = this.cleanFilter(filters.cashierEmail);
        if (cashierEmail) {
            where.cashier = {
                email: { contains: cashierEmail, mode: "insensitive" },
            };
        }
        const customerName = this.cleanFilter(filters.customerName);
        if (customerName) {
            where.customerName = { contains: customerName, mode: "insensitive" };
        }
        const documentNumber = this.cleanFilter(filters.documentNumber);
        if (documentNumber) {
            where.documentNumber = { contains: documentNumber, mode: "insensitive" };
        }
        return where;
    }
    parseChannelFilter(channel) {
        const normalized = this.cleanFilter(channel)?.toUpperCase();
        if (!normalized)
            return null;
        if (normalized === "TPV" || normalized === "DIRECT") {
            return normalized;
        }
        throw new common_1.BadRequestException("Filtro channel invalido. Use TPV o DIRECT.");
    }
    cleanFilter(value) {
        if (!value)
            return null;
        const trimmed = value.trim();
        return trimmed.length ? trimmed : null;
    }
    getServerDateInfo() {
        const now = new Date();
        return {
            serverDate: this.formatServerDateOnly(now),
            serverTimezone: this.getServerTimezone(),
            serverNow: now.toISOString(),
            serverNowLabel: this.formatServerDateTime(now),
        };
    }
    groupSalesByPaymentMethod(sales) {
        const paymentMethodTotals = {};
        for (const sale of sales) {
            for (const payment of sale.payments) {
                const method = payment.method || "OTHER";
                const currency = payment.currency || "CUP";
                const key = `${method}::${currency}`;
                if (!paymentMethodTotals[key]) {
                    paymentMethodTotals[key] = {
                        method,
                        currency,
                        amountOriginal: 0,
                        amountBase: 0,
                    };
                }
                paymentMethodTotals[key].amountOriginal += Number(payment.amountOriginal || 0);
                paymentMethodTotals[key].amountBase += Number(payment.amount || 0);
            }
        }
        return Object.values(paymentMethodTotals)
            .map((row) => ({
            method: row.method,
            currency: row.currency,
            amountOriginal: Number(row.amountOriginal.toFixed(2)),
            amountBase: Number(row.amountBase.toFixed(2)),
        }))
            .sort((a, b) => {
            const methodOrder = a.method.localeCompare(b.method);
            if (methodOrder !== 0)
                return methodOrder;
            return a.currency.localeCompare(b.currency);
        });
    }
    groupSalesByCashier(sales) {
        const cashierTotals = {};
        for (const sale of sales) {
            const cashierId = sale.cashierId;
            if (!cashierTotals[cashierId]) {
                cashierTotals[cashierId] = {
                    name: sale.cashier.email,
                    sales: 0,
                    amount: 0,
                };
            }
            cashierTotals[cashierId].sales += 1;
            cashierTotals[cashierId].amount += Number(sale.total || 0);
        }
        return Object.values(cashierTotals).map((row) => ({
            ...row,
            amount: Number(row.amount.toFixed(2)),
        }));
    }
    resolveDateRange(startDate, endDate) {
        const now = new Date();
        const today = this.formatServerDateOnly(now);
        const effectiveStartDate = startDate || endDate || today;
        const effectiveEndDate = endDate || startDate || today;
        const start = this.parseServerDate(effectiveStartDate, false);
        const end = this.parseServerDate(effectiveEndDate, true);
        if (start.getTime() > end.getTime()) {
            throw new common_1.BadRequestException("startDate no puede ser mayor que endDate.");
        }
        return {
            start,
            end,
            startDate: effectiveStartDate,
            endDate: effectiveEndDate,
            serverDate: today,
            serverTimezone: this.getServerTimezone(),
        };
    }
    parseServerDate(dateInput, endOfDay) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
            throw new common_1.BadRequestException("Formato de fecha inválido. Use YYYY-MM-DD.");
        }
        const [yearText, monthText, dayText] = dateInput.split("-");
        const year = Number(yearText);
        const month = Number(monthText);
        const day = Number(dayText);
        const date = endOfDay
            ? new Date(year, month - 1, day, 23, 59, 59, 999)
            : new Date(year, month - 1, day, 0, 0, 0, 0);
        if (Number.isNaN(date.getTime()) ||
            date.getFullYear() !== year ||
            date.getMonth() !== month - 1 ||
            date.getDate() !== day) {
            throw new common_1.BadRequestException("Fecha inválida.");
        }
        return date;
    }
    formatServerDateOnly(date) {
        const year = date.getFullYear();
        const month = `${date.getMonth() + 1}`.padStart(2, "0");
        const day = `${date.getDate()}`.padStart(2, "0");
        return `${year}-${month}-${day}`;
    }
    formatServerDateTime(date) {
        const formatter = new Intl.DateTimeFormat("es-ES", {
            timeZone: this.getServerTimezone(),
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        });
        return formatter.format(date);
    }
    getServerTimezone() {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    }
};
exports.ReportsService = ReportsService;
exports.ReportsService = ReportsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ReportsService);
//# sourceMappingURL=reports.service.js.map