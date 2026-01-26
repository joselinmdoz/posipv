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
exports.StockMovementsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let StockMovementsService = class StockMovementsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    list(params) {
        const where = {};
        if (params?.warehouseId) {
            where.OR = [
                { fromWarehouseId: params.warehouseId },
                { toWarehouseId: params.warehouseId },
            ];
        }
        if (params?.from || params?.to) {
            where.createdAt = {};
            if (params.from)
                where.createdAt.gte = new Date(params.from);
            if (params.to)
                where.createdAt.lte = new Date(params.to);
        }
        return this.prisma.stockMovement.findMany({
            where,
            include: {
                product: { select: { id: true, name: true } },
                fromWarehouse: { select: { id: true, name: true } },
                toWarehouse: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "desc" },
        });
    }
    async create(dto) {
        return this.prisma.$transaction(async (tx) => {
            const movement = await tx.stockMovement.create({
                data: dto,
                include: {
                    product: { select: { id: true, name: true } },
                    fromWarehouse: { select: { id: true, name: true } },
                    toWarehouse: { select: { id: true, name: true } },
                },
            });
            if (dto.type === 'IN') {
                if (!dto.toWarehouseId)
                    throw new Error('toWarehouseId required for IN');
                await this.adjustStock(tx, dto.toWarehouseId, dto.productId, dto.qty);
            }
            else if (dto.type === 'OUT') {
                if (!dto.fromWarehouseId)
                    throw new Error('fromWarehouseId required for OUT');
                await this.adjustStock(tx, dto.fromWarehouseId, dto.productId, -dto.qty);
            }
            else if (dto.type === 'TRANSFER') {
                if (!dto.fromWarehouseId || !dto.toWarehouseId)
                    throw new Error('fromWarehouseId and toWarehouseId required for TRANSFER');
                await this.adjustStock(tx, dto.fromWarehouseId, dto.productId, -dto.qty);
                await this.adjustStock(tx, dto.toWarehouseId, dto.productId, dto.qty);
            }
            return movement;
        });
    }
    async adjustStock(tx, warehouseId, productId, qty) {
        const existing = await tx.stock.findUnique({
            where: { warehouseId_productId: { warehouseId, productId } },
        });
        if (existing) {
            await tx.stock.update({
                where: { warehouseId_productId: { warehouseId, productId } },
                data: { qty: { increment: qty } },
            });
        }
        else {
            await tx.stock.create({
                data: { warehouseId, productId, qty },
            });
        }
    }
};
exports.StockMovementsService = StockMovementsService;
exports.StockMovementsService = StockMovementsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], StockMovementsService);
//# sourceMappingURL=stock-movements.service.js.map