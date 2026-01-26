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
const client_2 = require("@prisma/client");
let SalesService = class SalesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createSale(cashierId, dto) {
        const session = await this.prisma.cashSession.findUnique({
            where: { id: dto.cashSessionId },
            include: { register: true },
        });
        if (!session)
            throw new common_1.NotFoundException("Sesión de caja no existe.");
        if (session.status !== client_1.CashSessionStatus.OPEN)
            throw new common_1.BadRequestException("La sesión no está abierta.");
        if (!dto.items?.length)
            throw new common_1.BadRequestException("Sin items.");
        if (!dto.payments?.length)
            throw new common_1.BadRequestException("Sin pagos.");
        const productIds = dto.items.map((i) => i.productId);
        const products = await this.prisma.product.findMany({
            where: { id: { in: productIds }, active: true },
        });
        if (products.length !== productIds.length)
            throw new common_1.BadRequestException("Producto inválido o inactivo.");
        const priceMap = new Map(products.map((p) => [p.id, p.price]));
        let total = new client_2.Prisma.Decimal(0);
        const itemsData = dto.items.map((i) => {
            const price = priceMap.get(i.productId);
            if (!price)
                throw new common_1.BadRequestException("Producto inválido.");
            total = total.add(price.mul(i.qty));
            return { productId: i.productId, qty: i.qty, price: price };
        });
        const paySum = dto.payments.reduce((acc, p) => acc.add((0, decimal_1.dec)(p.amount)), new client_2.Prisma.Decimal(0));
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
                        create: dto.payments.map((p) => ({
                            method: p.method,
                            amount: (0, decimal_1.dec)(p.amount),
                        })),
                    },
                },
                include: { items: true, payments: true },
            });
            return sale;
        });
    }
};
exports.SalesService = SalesService;
exports.SalesService = SalesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SalesService);
//# sourceMappingURL=sales.service.js.map