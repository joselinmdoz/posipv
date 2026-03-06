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
};
exports.WarehousesService = WarehousesService;
exports.WarehousesService = WarehousesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], WarehousesService);
//# sourceMappingURL=warehouses.service.js.map