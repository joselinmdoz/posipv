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
exports.DashboardService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let DashboardService = class DashboardService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getSummary() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [salesToday, transactionsToday, openSessions, lastSale, lowStock] = await Promise.all([
            this.prisma.sale.aggregate({
                where: {
                    createdAt: { gte: today },
                    status: { not: "VOID" },
                },
                _sum: { total: true },
            }),
            this.prisma.sale.count({
                where: {
                    createdAt: { gte: today },
                    status: { not: "VOID" },
                },
            }),
            this.prisma.cashSession.count({
                where: { status: "OPEN" },
            }),
            this.prisma.sale.findFirst({
                where: { status: { not: "VOID" } },
                orderBy: { createdAt: "desc" },
                select: { createdAt: true },
            }),
            Promise.resolve(0),
        ]);
        return {
            salesToday: parseFloat((salesToday._sum.total || 0).toFixed(2)),
            transactionsToday,
            openSessions,
            lowStock,
            lastSaleAt: lastSale?.createdAt.toISOString(),
        };
    }
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map