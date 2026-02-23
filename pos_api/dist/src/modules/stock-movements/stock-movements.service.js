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
        const normalized = {
            type: dto.type,
            productId: this.normalizeId(dto.productId),
            qty: Number(dto.qty),
            fromWarehouseId: this.normalizeId(dto.fromWarehouseId),
            toWarehouseId: this.normalizeId(dto.toWarehouseId),
            reason: dto.reason?.trim() || null,
        };
        if (!normalized.productId)
            throw new common_1.BadRequestException("productId es requerido.");
        const productId = normalized.productId;
        if (!Number.isFinite(normalized.qty) || normalized.qty <= 0 || !Number.isInteger(normalized.qty)) {
            throw new common_1.BadRequestException("qty debe ser un entero mayor a 0.");
        }
        if (normalized.type === "IN" && !normalized.toWarehouseId) {
            throw new common_1.BadRequestException("toWarehouseId requerido para movimiento IN.");
        }
        if (normalized.type === "OUT" && !normalized.fromWarehouseId) {
            throw new common_1.BadRequestException("fromWarehouseId requerido para movimiento OUT.");
        }
        if (normalized.type === "TRANSFER" && (!normalized.fromWarehouseId || !normalized.toWarehouseId)) {
            throw new common_1.BadRequestException("fromWarehouseId y toWarehouseId requeridos para TRANSFER.");
        }
        if (normalized.type === "TRANSFER" &&
            normalized.fromWarehouseId &&
            normalized.toWarehouseId &&
            normalized.fromWarehouseId === normalized.toWarehouseId) {
            throw new common_1.BadRequestException("Origen y destino no pueden ser el mismo almacén.");
        }
        const product = await this.prisma.product.findUnique({
            where: { id: productId },
            select: { id: true, active: true },
        });
        if (!product || !product.active) {
            throw new common_1.NotFoundException("Producto no existe o está inactivo.");
        }
        const warehouseIds = [normalized.fromWarehouseId, normalized.toWarehouseId].filter((id) => Boolean(id));
        if (warehouseIds.length > 0) {
            const warehouses = await this.prisma.warehouse.findMany({
                where: { id: { in: warehouseIds }, active: true },
                select: { id: true },
            });
            if (warehouses.length !== warehouseIds.length) {
                throw new common_1.NotFoundException("Almacén de origen o destino no existe o está inactivo.");
            }
        }
        return this.prisma.$transaction(async (tx) => {
            const movement = await tx.stockMovement.create({
                data: {
                    type: normalized.type,
                    productId,
                    qty: normalized.qty,
                    fromWarehouseId: normalized.fromWarehouseId,
                    toWarehouseId: normalized.toWarehouseId,
                    reason: normalized.reason,
                },
                include: {
                    product: { select: { id: true, name: true } },
                    fromWarehouse: { select: { id: true, name: true } },
                    toWarehouse: { select: { id: true, name: true } },
                },
            });
            if (normalized.type === "IN") {
                const toWarehouseId = normalized.toWarehouseId;
                if (!toWarehouseId)
                    throw new common_1.BadRequestException("toWarehouseId requerido para IN.");
                await this.adjustStock(tx, toWarehouseId, productId, normalized.qty);
            }
            else if (normalized.type === "OUT") {
                const fromWarehouseId = normalized.fromWarehouseId;
                if (!fromWarehouseId)
                    throw new common_1.BadRequestException("fromWarehouseId requerido para OUT.");
                await this.adjustStock(tx, fromWarehouseId, productId, -normalized.qty);
            }
            else if (normalized.type === "TRANSFER") {
                const fromWarehouseId = normalized.fromWarehouseId;
                const toWarehouseId = normalized.toWarehouseId;
                if (!fromWarehouseId || !toWarehouseId) {
                    throw new common_1.BadRequestException("fromWarehouseId y toWarehouseId requeridos para TRANSFER.");
                }
                await this.adjustStock(tx, fromWarehouseId, productId, -normalized.qty);
                await this.adjustStock(tx, toWarehouseId, productId, normalized.qty);
            }
            return movement;
        });
    }
    async adjustStock(tx, warehouseId, productId, qty) {
        const existing = await tx.stock.findUnique({
            where: { warehouseId_productId: { warehouseId, productId } },
        });
        if (qty < 0) {
            const required = Math.abs(qty);
            if (!existing || existing.qty < required) {
                throw new common_1.BadRequestException("Stock insuficiente para realizar el movimiento.");
            }
        }
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
    normalizeId(value) {
        if (!value)
            return null;
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
    }
};
exports.StockMovementsService = StockMovementsService;
exports.StockMovementsService = StockMovementsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], StockMovementsService);
//# sourceMappingURL=stock-movements.service.js.map