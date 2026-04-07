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
const accounting_service_1 = require("../accounting/accounting.service");
const inventory_costing_service_1 = require("../inventory-costing/inventory-costing.service");
let StockMovementsService = class StockMovementsService {
    constructor(prisma, accountingService, inventoryCostingService) {
        this.prisma = prisma;
        this.accountingService = accountingService;
        this.inventoryCostingService = inventoryCostingService;
    }
    list(params) {
        const where = {};
        if (params?.warehouseId) {
            where.OR = [
                { fromWarehouseId: params.warehouseId },
                { toWarehouseId: params.warehouseId },
            ];
        }
        if (params?.type) {
            const validTypes = new Set(["IN", "OUT", "TRANSFER"]);
            if (!validTypes.has(params.type)) {
                throw new common_1.BadRequestException("Tipo de movimiento inválido.");
            }
            where.type = params.type;
        }
        if (params?.reason?.trim()) {
            where.reason = { contains: params.reason.trim(), mode: "insensitive" };
        }
        const fromDate = params?.from ? this.parseDateParam(params.from, false) : null;
        const toDate = params?.to ? this.parseDateParam(params.to, true) : null;
        if (params?.from && !fromDate) {
            throw new common_1.BadRequestException("Fecha 'from' inválida.");
        }
        if (params?.to && !toDate) {
            throw new common_1.BadRequestException("Fecha 'to' inválida.");
        }
        if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
            throw new common_1.BadRequestException("El rango de fechas es inválido.");
        }
        if (fromDate || toDate) {
            where.createdAt = {};
            if (fromDate)
                where.createdAt.gte = fromDate;
            if (toDate)
                where.createdAt.lte = toDate;
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
    parseDateParam(value, endOfDay) {
        const trimmed = value.trim();
        if (!trimmed)
            return null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
            const [y, m, d] = trimmed.split("-").map(Number);
            const date = endOfDay
                ? new Date(y, m - 1, d, 23, 59, 59, 999)
                : new Date(y, m - 1, d, 0, 0, 0, 0);
            if (date.getFullYear() !== y ||
                date.getMonth() !== m - 1 ||
                date.getDate() !== d) {
                return null;
            }
            return date;
        }
        const parsed = new Date(trimmed);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    async create(dto, createdByUserId) {
        let normalized = {
            type: dto.type,
            productId: this.normalizeId(dto.productId),
            qty: Number(Number(dto.qty).toFixed(2)),
            fromWarehouseId: this.normalizeId(dto.fromWarehouseId),
            toWarehouseId: this.normalizeId(dto.toWarehouseId),
            reason: dto.reason?.trim() || null,
        };
        if (!normalized.productId)
            throw new common_1.BadRequestException("productId es requerido.");
        const productId = normalized.productId;
        if (!Number.isFinite(normalized.qty) || normalized.qty <= 0) {
            throw new common_1.BadRequestException("qty debe ser mayor a 0.");
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
            select: { id: true, active: true, allowFractionalQty: true, cost: true },
        });
        if (!product || !product.active) {
            throw new common_1.NotFoundException("Producto no existe o está inactivo.");
        }
        if (!product.allowFractionalQty && !Number.isInteger(normalized.qty)) {
            throw new common_1.BadRequestException("Este producto solo admite cantidades enteras en movimientos.");
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
                await this.inventoryCostingService.createAdjustmentLot(tx, {
                    warehouseId: toWarehouseId,
                    productId,
                    qty: normalized.qty,
                    unitCost: product.cost || 0,
                    reference: `MOVIMIENTO:${movement.id}:IN`,
                    receivedAt: movement.createdAt,
                });
            }
            else if (normalized.type === "OUT") {
                const fromWarehouseId = normalized.fromWarehouseId;
                if (!fromWarehouseId)
                    throw new common_1.BadRequestException("fromWarehouseId requerido para OUT.");
                await this.adjustStock(tx, fromWarehouseId, productId, -normalized.qty);
                await this.inventoryCostingService.consumeStockWithFifo(tx, {
                    warehouseId: fromWarehouseId,
                    productId,
                    qty: normalized.qty,
                    fallbackUnitCost: product.cost || 0,
                    reference: `MOVIMIENTO:${movement.id}:OUT`,
                    receivedAt: movement.createdAt,
                });
            }
            else if (normalized.type === "TRANSFER") {
                const fromWarehouseId = normalized.fromWarehouseId;
                const toWarehouseId = normalized.toWarehouseId;
                if (!fromWarehouseId || !toWarehouseId) {
                    throw new common_1.BadRequestException("fromWarehouseId y toWarehouseId requeridos para TRANSFER.");
                }
                const consumed = await this.inventoryCostingService.consumeStockWithFifo(tx, {
                    warehouseId: fromWarehouseId,
                    productId,
                    qty: normalized.qty,
                    fallbackUnitCost: product.cost || 0,
                    reference: `MOVIMIENTO:${movement.id}:TRANSFER_OUT`,
                    receivedAt: movement.createdAt,
                });
                await this.adjustStock(tx, fromWarehouseId, productId, -normalized.qty);
                await this.adjustStock(tx, toWarehouseId, productId, normalized.qty);
                await this.inventoryCostingService.createAdjustmentLot(tx, {
                    warehouseId: toWarehouseId,
                    productId,
                    qty: normalized.qty,
                    unitCost: consumed.averageUnitCost || Number(product.cost || 0),
                    reference: `MOVIMIENTO:${movement.id}:TRANSFER_IN`,
                    receivedAt: movement.createdAt,
                });
            }
            await this.accountingService.postAutomatedStockMovementEntry(tx, movement.id, createdByUserId);
            return movement;
        });
    }
    async delete(movementId, deletedByUserId) {
        const movement = await this.prisma.stockMovement.findUnique({
            where: { id: movementId },
            include: {
                product: { select: { id: true, name: true } },
                fromWarehouse: { select: { id: true, name: true } },
                toWarehouse: { select: { id: true, name: true } },
            },
        });
        if (!movement)
            throw new common_1.NotFoundException("Movimiento no encontrado.");
        if (this.isProtectedSystemMovement(movement.reason)) {
            throw new common_1.BadRequestException("No se puede eliminar un movimiento generado automáticamente por ventas o procesos del sistema.");
        }
        return this.prisma.$transaction(async (tx) => {
            const product = await tx.product.findUnique({
                where: { id: movement.productId },
                select: { id: true, cost: true },
            });
            const fallbackCost = Number(product?.cost || 0);
            if (movement.type === "IN") {
                if (!movement.toWarehouseId) {
                    throw new common_1.BadRequestException("Movimiento IN inválido: no tiene almacén de destino.");
                }
                await this.adjustStock(tx, movement.toWarehouseId, movement.productId, -Number(movement.qty));
                await this.inventoryCostingService.consumeStockWithFifo(tx, {
                    warehouseId: movement.toWarehouseId,
                    productId: movement.productId,
                    qty: Number(movement.qty),
                    fallbackUnitCost: fallbackCost,
                    reference: `REVERSA_MOVIMIENTO:${movement.id}:IN`,
                });
            }
            else if (movement.type === "OUT") {
                if (!movement.fromWarehouseId) {
                    throw new common_1.BadRequestException("Movimiento OUT inválido: no tiene almacén de origen.");
                }
                await this.adjustStock(tx, movement.fromWarehouseId, movement.productId, Number(movement.qty));
                await this.inventoryCostingService.createAdjustmentLot(tx, {
                    warehouseId: movement.fromWarehouseId,
                    productId: movement.productId,
                    qty: Number(movement.qty),
                    unitCost: fallbackCost,
                    reference: `REVERSA_MOVIMIENTO:${movement.id}:OUT`,
                });
            }
            else if (movement.type === "TRANSFER") {
                if (!movement.fromWarehouseId || !movement.toWarehouseId) {
                    throw new common_1.BadRequestException("Movimiento TRANSFER inválido: faltan almacenes.");
                }
                await this.adjustStock(tx, movement.fromWarehouseId, movement.productId, Number(movement.qty));
                await this.adjustStock(tx, movement.toWarehouseId, movement.productId, -Number(movement.qty));
                await this.inventoryCostingService.createAdjustmentLot(tx, {
                    warehouseId: movement.fromWarehouseId,
                    productId: movement.productId,
                    qty: Number(movement.qty),
                    unitCost: fallbackCost,
                    reference: `REVERSA_MOVIMIENTO:${movement.id}:TRANSFER_OUT`,
                });
                await this.inventoryCostingService.consumeStockWithFifo(tx, {
                    warehouseId: movement.toWarehouseId,
                    productId: movement.productId,
                    qty: Number(movement.qty),
                    fallbackUnitCost: fallbackCost,
                    reference: `REVERSA_MOVIMIENTO:${movement.id}:TRANSFER_IN`,
                });
            }
            await this.accountingService.voidAutomatedStockMovementEntry(tx, movement.id, `ELIMINACION_MOVIMIENTO:${movement.id}:${deletedByUserId}`);
            await tx.stockMovement.delete({ where: { id: movement.id } });
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
    isProtectedSystemMovement(reason) {
        const value = (reason || "").trim().toUpperCase();
        if (!value)
            return false;
        return (value === "VENTA" ||
            value === "VENTA_DIRECTA" ||
            value.startsWith("ELIMINACION_VENTA:") ||
            value.startsWith("MANUAL_IPV_") ||
            value.startsWith("RESET_STOCK:") ||
            value.startsWith("COMPRA:") ||
            value.startsWith("ANULACION_COMPRA:"));
    }
};
exports.StockMovementsService = StockMovementsService;
exports.StockMovementsService = StockMovementsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        accounting_service_1.AccountingService,
        inventory_costing_service_1.InventoryCostingService])
], StockMovementsService);
//# sourceMappingURL=stock-movements.service.js.map