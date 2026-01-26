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
    async getSalesReport(startDate, endDate) {
        const sales = await this.prisma.sale.findMany({
            where: {
                createdAt: {
                    gte: startDate,
                    lte: endDate,
                },
                status: { not: "VOID" },
            },
            include: {
                items: true,
                payments: true,
                cashier: true,
            },
        });
        return {
            totalSales: sales.length,
            totalAmount: parseFloat(sales.reduce((sum, sale) => sum.add(sale.total), (0, decimal_1.dec)(0)).toFixed(2)),
            averageTicket: sales.length > 0
                ? parseFloat((sales.reduce((sum, sale) => sum.add(sale.total), (0, decimal_1.dec)(0)).toNumber() / sales.length).toFixed(2))
                : 0,
            salesByPaymentMethod: this.groupSalesByPaymentMethod(sales),
            salesByCashier: this.groupSalesByCashier(sales),
            detailedSales: sales,
        };
    }
    groupSalesByPaymentMethod(sales) {
        const paymentMethodTotals = {};
        sales.forEach((sale) => {
            sale.payments.forEach((payment) => {
                const method = payment.method;
                if (!paymentMethodTotals[method]) {
                    paymentMethodTotals[method] = 0;
                }
                paymentMethodTotals[method] += parseFloat(payment.amount.toFixed(2));
            });
        });
        return Object.entries(paymentMethodTotals).map(([method, amount]) => ({
            method,
            amount,
        }));
    }
    groupSalesByCashier(sales) {
        const cashierTotals = {};
        sales.forEach((sale) => {
            const cashierId = sale.cashierId;
            if (!cashierTotals[cashierId]) {
                cashierTotals[cashierId] = {
                    name: sale.cashier.email,
                    sales: 0,
                    amount: 0,
                };
            }
            cashierTotals[cashierId].sales += 1;
            cashierTotals[cashierId].amount += parseFloat(sale.total.toFixed(2));
        });
        return Object.values(cashierTotals);
    }
};
exports.ReportsService = ReportsService;
exports.ReportsService = ReportsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ReportsService);
//# sourceMappingURL=reports.service.js.map