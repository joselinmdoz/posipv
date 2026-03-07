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
exports.CashSessionsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const client_1 = require("@prisma/client");
const decimal_1 = require("../../common/decimal");
const inventory_reports_service_1 = require("../inventory-reports/inventory-reports.service");
let CashSessionsService = class CashSessionsService {
    constructor(prisma, inventoryReportsService) {
        this.prisma = prisma;
        this.inventoryReportsService = inventoryReportsService;
    }
    async findAll() {
        const sessions = await this.prisma.cashSession.findMany({
            include: {
                register: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                        settings: {
                            select: {
                                warehouseId: true,
                            },
                        },
                    },
                },
                openedBy: {
                    select: {
                        id: true,
                        email: true,
                        employee: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                openedAt: "desc",
            },
        });
        return sessions.map((session) => ({
            ...session,
            warehouseId: session.register.settings?.warehouseId || null,
            register: {
                id: session.register.id,
                name: session.register.name,
                code: session.register.code,
            },
        }));
    }
    async findOne(id) {
        const session = await this.prisma.cashSession.findUnique({
            where: { id },
            include: {
                register: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                        settings: {
                            select: {
                                warehouseId: true,
                            },
                        },
                    },
                },
                openedBy: {
                    select: {
                        id: true,
                        email: true,
                        employee: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                            },
                        },
                    },
                },
            },
        });
        if (!session)
            throw new common_1.NotFoundException("Sesión no encontrada.");
        return {
            ...session,
            warehouseId: session.register.settings?.warehouseId || null,
            register: {
                id: session.register.id,
                name: session.register.name,
                code: session.register.code,
            },
        };
    }
    getOpenByRegister(registerId) {
        return this.prisma.cashSession.findFirst({
            where: { registerId, status: client_1.CashSessionStatus.OPEN },
            orderBy: { openedAt: "desc" },
        });
    }
    async open(input) {
        const reg = await this.prisma.register.findUnique({ where: { id: input.registerId } });
        if (!reg || !reg.active)
            throw new common_1.NotFoundException("Caja no existe o está inactiva.");
        const openExisting = await this.getOpenByRegister(input.registerId);
        if (openExisting)
            throw new common_1.BadRequestException("Esa caja ya tiene una sesión abierta.");
        const session = await this.prisma.cashSession.create({
            data: {
                registerId: input.registerId,
                openingAmount: (0, decimal_1.dec)(input.openingAmount),
                note: input.note,
                openedById: input.openedById,
            },
        });
        await this.inventoryReportsService.ensureInitialReportForSession(session.id);
        return session;
    }
    async close(id, closingAmount, note) {
        const sess = await this.prisma.cashSession.findUnique({ where: { id } });
        if (!sess)
            throw new common_1.NotFoundException("Sesión no encontrada.");
        if (sess.status === client_1.CashSessionStatus.CLOSED)
            throw new common_1.BadRequestException("Ya está cerrada.");
        const summary = await this.getSessionSummary(id);
        const enteredCash = (0, decimal_1.dec)(closingAmount);
        const expectedCash = (0, decimal_1.dec)(summary.paymentTotals.CASH);
        if (!(0, decimal_1.moneyEq)(enteredCash, expectedCash)) {
            throw new common_1.BadRequestException(`El efectivo contado (${enteredCash.toFixed(2)}) no coincide con el efectivo de ventas (${expectedCash.toFixed(2)}).`);
        }
        const closedAt = new Date();
        return this.prisma.cashSession.update({
            where: { id },
            data: {
                status: client_1.CashSessionStatus.CLOSED,
                closedAt,
                closingAmount: (0, decimal_1.dec)(closingAmount),
                note,
            },
        });
    }
    async getSessionSummary(id) {
        const session = await this.prisma.cashSession.findUnique({
            where: { id },
            include: {
                register: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                    },
                },
            },
        });
        if (!session)
            throw new common_1.NotFoundException("Sesión no encontrada.");
        const [salesAgg, paymentGroup] = await Promise.all([
            this.prisma.sale.aggregate({
                where: {
                    cashSessionId: id,
                    status: client_1.SaleStatus.PAID,
                },
                _sum: {
                    total: true,
                },
                _count: {
                    _all: true,
                },
            }),
            this.prisma.payment.groupBy({
                by: ["method"],
                where: {
                    sale: {
                        cashSessionId: id,
                        status: client_1.SaleStatus.PAID,
                    },
                },
                _sum: {
                    amount: true,
                },
            }),
        ]);
        const paymentTotals = this.buildPaymentTotals(paymentGroup);
        const totalSales = (0, decimal_1.dec)(salesAgg._sum.total ?? 0);
        return {
            id: session.id,
            status: session.status,
            openedAt: session.openedAt,
            closedAt: session.closedAt,
            openingAmount: Number(session.openingAmount.toFixed(2)),
            register: session.register,
            salesCount: salesAgg._count._all,
            totalSales: Number(totalSales.toFixed(2)),
            paymentTotals: {
                CASH: Number(paymentTotals.CASH.toFixed(2)),
                CARD: Number(paymentTotals.CARD.toFixed(2)),
                TRANSFER: Number(paymentTotals.TRANSFER.toFixed(2)),
                OTHER: Number(paymentTotals.OTHER.toFixed(2)),
            },
        };
    }
    buildPaymentTotals(grouped) {
        const totals = {
            CASH: (0, decimal_1.dec)(0),
            CARD: (0, decimal_1.dec)(0),
            TRANSFER: (0, decimal_1.dec)(0),
            OTHER: (0, decimal_1.dec)(0),
        };
        for (const row of grouped) {
            totals[row.method] = (0, decimal_1.dec)(row._sum.amount ?? 0);
        }
        return totals;
    }
};
exports.CashSessionsService = CashSessionsService;
exports.CashSessionsService = CashSessionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        inventory_reports_service_1.InventoryReportsService])
], CashSessionsService);
//# sourceMappingURL=cash-sessions.service.js.map