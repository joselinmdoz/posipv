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
exports.WarehousesService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../prisma/prisma.service");
let WarehousesService = class WarehousesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    list() {
        return this.prisma.warehouse.findMany({
            where: { active: true },
            orderBy: { createdAt: "desc" },
        });
    }
    create(dto) {
        return this.prisma.warehouse.create({
            data: {
                name: dto.name,
                code: dto.code,
                type: dto.type || 'TPV',
            },
        });
    }
    getStock(warehouseId) {
        return this.prisma.stock.findMany({
            where: { warehouseId },
            include: {
                product: {
                    include: {
                        productType: true,
                        productCategory: true,
                        measurementUnit: true,
                    },
                },
            },
            orderBy: { product: { name: 'asc' } },
        });
    }
    findOne(id) {
        return this.prisma.warehouse.findUnique({
            where: { id },
        });
    }
    update(id, dto) {
        return this.prisma.warehouse.update({
            where: { id },
            data: dto,
        });
    }
    delete(id) {
        return this.prisma.$transaction(async (tx) => {
            const warehouse = await tx.warehouse.findUnique({
                where: { id },
                include: {
                    register: {
                        select: {
                            cashSessions: {
                                where: { status: client_1.CashSessionStatus.OPEN },
                                select: { id: true },
                            },
                        },
                    },
                },
            });
            if (!warehouse)
                throw new common_1.NotFoundException("Almacén no encontrado.");
            if (warehouse.register?.cashSessions?.length) {
                throw new common_1.BadRequestException("No se puede eliminar el almacén mientras exista una sesión de caja abierta.");
            }
            return tx.warehouse.update({
                where: { id },
                data: { active: false },
            });
        });
    }
    async resetStock(id, reason) {
        const warehouse = await this.prisma.warehouse.findUnique({
            where: { id },
            select: { id: true, name: true, active: true },
        });
        if (!warehouse)
            throw new common_1.NotFoundException("Almacén no encontrado.");
        if (!warehouse.active)
            throw new common_1.BadRequestException("No se puede resetear stock de un almacén inactivo.");
        const rows = await this.prisma.stock.findMany({
            where: {
                warehouseId: id,
                qty: { gt: 0 },
            },
            select: {
                id: true,
                productId: true,
                qty: true,
            },
        });
        if (rows.length === 0) {
            return { ok: true, warehouseId: id, resetProducts: 0, resetQty: 0 };
        }
        const safeReason = (reason || "Reinicio manual").trim();
        return this.prisma.$transaction(async (tx) => {
            for (const row of rows) {
                await tx.stockMovement.create({
                    data: {
                        type: client_1.StockMovementType.OUT,
                        productId: row.productId,
                        qty: row.qty,
                        fromWarehouseId: id,
                        reason: `RESET_STOCK:${safeReason}`,
                    },
                });
            }
            await tx.stock.updateMany({
                where: {
                    warehouseId: id,
                    qty: { gt: 0 },
                },
                data: {
                    qty: 0,
                },
            });
            const resetQty = rows.reduce((sum, row) => sum + Number(row.qty), 0);
            return {
                ok: true,
                warehouseId: id,
                resetProducts: rows.length,
                resetQty,
            };
        });
    }
    async updateStockQty(warehouseId, productId, qty, reason) {
        const normalizedQty = Number(qty);
        if (!Number.isFinite(normalizedQty) || normalizedQty < 0) {
            throw new common_1.BadRequestException("La cantidad debe ser un número válido mayor o igual a 0.");
        }
        const [warehouse, product, existing] = await Promise.all([
            this.prisma.warehouse.findUnique({
                where: { id: warehouseId },
                select: { id: true, active: true },
            }),
            this.prisma.product.findUnique({
                where: { id: productId },
                select: { id: true, active: true, allowFractionalQty: true },
            }),
            this.prisma.stock.findUnique({
                where: { warehouseId_productId: { warehouseId, productId } },
                select: { id: true, qty: true },
            }),
        ]);
        if (!warehouse || !warehouse.active) {
            throw new common_1.NotFoundException("Almacén no encontrado o inactivo.");
        }
        if (!product || !product.active) {
            throw new common_1.NotFoundException("Producto no encontrado o inactivo.");
        }
        if (!existing) {
            throw new common_1.NotFoundException("No existe stock de este producto en el almacén.");
        }
        const safeQty = product.allowFractionalQty
            ? Number(normalizedQty.toFixed(2))
            : Math.floor(normalizedQty);
        if (!product.allowFractionalQty && !Number.isInteger(normalizedQty)) {
            throw new common_1.BadRequestException("Este producto solo admite cantidades enteras.");
        }
        const currentQty = Number(existing.qty);
        const delta = Number((safeQty - currentQty).toFixed(2));
        if (delta === 0) {
            return this.prisma.stock.findUnique({
                where: { id: existing.id },
                include: {
                    product: {
                        include: {
                            productType: true,
                            productCategory: true,
                            measurementUnit: true,
                        },
                    },
                },
            });
        }
        const movementReason = `AJUSTE_STOCK:${(reason || "Ajuste manual de stock").trim()}`;
        return this.prisma.$transaction(async (tx) => {
            if (delta > 0) {
                await tx.stockMovement.create({
                    data: {
                        type: client_1.StockMovementType.IN,
                        productId,
                        qty: delta,
                        toWarehouseId: warehouseId,
                        reason: movementReason,
                    },
                });
            }
            else {
                await tx.stockMovement.create({
                    data: {
                        type: client_1.StockMovementType.OUT,
                        productId,
                        qty: Math.abs(delta),
                        fromWarehouseId: warehouseId,
                        reason: movementReason,
                    },
                });
            }
            return tx.stock.update({
                where: { warehouseId_productId: { warehouseId, productId } },
                data: { qty: safeQty },
                include: {
                    product: {
                        include: {
                            productType: true,
                            productCategory: true,
                            measurementUnit: true,
                        },
                    },
                },
            });
        });
    }
    async removeStockItem(warehouseId, productId, reason) {
        const [warehouse, existing] = await Promise.all([
            this.prisma.warehouse.findUnique({
                where: { id: warehouseId },
                select: { id: true, active: true },
            }),
            this.prisma.stock.findUnique({
                where: { warehouseId_productId: { warehouseId, productId } },
                select: { id: true, qty: true },
            }),
        ]);
        if (!warehouse || !warehouse.active) {
            throw new common_1.NotFoundException("Almacén no encontrado o inactivo.");
        }
        if (!existing) {
            throw new common_1.NotFoundException("No existe stock de este producto en el almacén.");
        }
        const removedQty = Number(existing.qty);
        const movementReason = `ELIMINAR_STOCK:${(reason || "Eliminación manual desde stock").trim()}`;
        return this.prisma.$transaction(async (tx) => {
            if (removedQty > 0) {
                await tx.stockMovement.create({
                    data: {
                        type: client_1.StockMovementType.OUT,
                        productId,
                        qty: removedQty,
                        fromWarehouseId: warehouseId,
                        reason: movementReason,
                    },
                });
            }
            await tx.stock.delete({
                where: { warehouseId_productId: { warehouseId, productId } },
            });
            return {
                ok: true,
                warehouseId,
                productId,
                removedQty,
            };
        });
    }
};
exports.WarehousesService = WarehousesService;
exports.WarehousesService = WarehousesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], WarehousesService);
//# sourceMappingURL=warehouses.service.js.map