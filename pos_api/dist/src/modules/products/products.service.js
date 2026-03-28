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
exports.ProductsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const decimal_1 = require("../../common/decimal");
const client_1 = require("@prisma/client");
let ProductsService = class ProductsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    list(includeInactive = false) {
        return this.prisma.product.findMany({
            where: includeInactive ? undefined : { active: true },
            orderBy: { createdAt: "desc" },
            include: {
                productType: true,
                productCategory: true,
                measurementUnit: true,
            },
        });
    }
    async create(dto) {
        try {
            return await this.prisma.product.create({
                data: {
                    name: dto.name,
                    codigo: this.asOptional(dto.codigo),
                    barcode: this.asOptional(dto.barcode),
                    price: (0, decimal_1.dec)(dto.price),
                    cost: dto.cost ? (0, decimal_1.dec)(dto.cost) : undefined,
                    lowStockAlertQty: this.asOptionalDecimal(dto.lowStockAlertQty),
                    allowFractionalQty: dto.allowFractionalQty === true,
                    currency: dto.currency || client_1.CurrencyCode.CUP,
                    image: this.asOptional(dto.image),
                    productTypeId: this.asOptional(dto.productTypeId),
                    productCategoryId: this.asOptional(dto.productCategoryId),
                    measurementUnitId: this.asOptional(dto.measurementUnitId),
                },
            });
        }
        catch (error) {
            this.handlePrismaError(error);
        }
    }
    async update(id, dto) {
        try {
            return await this.prisma.product.update({
                where: { id },
                data: {
                    name: dto.name,
                    codigo: dto.codigo !== undefined ? this.asOptional(dto.codigo) : undefined,
                    barcode: dto.barcode !== undefined ? this.asOptional(dto.barcode) : undefined,
                    price: dto.price ? (0, decimal_1.dec)(dto.price) : undefined,
                    cost: dto.cost ? (0, decimal_1.dec)(dto.cost) : undefined,
                    lowStockAlertQty: dto.lowStockAlertQty !== undefined ? this.asOptionalDecimal(dto.lowStockAlertQty) : undefined,
                    allowFractionalQty: dto.allowFractionalQty,
                    currency: dto.currency !== undefined ? dto.currency : undefined,
                    image: dto.image,
                    active: dto.active,
                    productTypeId: dto.productTypeId !== undefined ? this.asOptional(dto.productTypeId) : undefined,
                    productCategoryId: dto.productCategoryId !== undefined ? this.asOptional(dto.productCategoryId) : undefined,
                    measurementUnitId: dto.measurementUnitId !== undefined ? this.asOptional(dto.measurementUnitId) : undefined,
                },
            });
        }
        catch (error) {
            this.handlePrismaError(error);
        }
    }
    findOne(id) {
        return this.prisma.product.findUnique({
            where: { id },
            include: {
                productType: true,
                productCategory: true,
                measurementUnit: true,
            },
        });
    }
    delete(id) {
        return this.prisma.product.update({
            where: { id },
            data: { active: false },
        });
    }
    asOptional(value) {
        if (value === undefined || value === null)
            return undefined;
        const normalized = String(value).trim();
        return normalized.length > 0 ? normalized : undefined;
    }
    asOptionalDecimal(value) {
        const normalized = this.asOptional(value);
        if (normalized === undefined)
            return undefined;
        const parsed = (0, decimal_1.dec)(normalized);
        if (!parsed.isFinite() || parsed.lt(0)) {
            throw new common_1.BadRequestException("El umbral de stock bajo debe ser un número mayor o igual a 0.");
        }
        return (0, decimal_1.dec)(parsed.toFixed(3));
    }
    handlePrismaError(error) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
            if (error.code === "P2002") {
                const target = Array.isArray(error.meta?.target)
                    ? error.meta.target
                    : [];
                if (target.includes("codigo")) {
                    throw new common_1.ConflictException("Ya existe un producto con ese código.");
                }
                if (target.includes("barcode")) {
                    throw new common_1.ConflictException("Ya existe un producto con ese código de barras.");
                }
                throw new common_1.ConflictException("Ya existe un producto con datos únicos duplicados.");
            }
            if (error.code === "P2003") {
                throw new common_1.BadRequestException("Referencia inválida en tipo/categoría/unidad de medida.");
            }
        }
        if (error instanceof Error) {
            throw new common_1.BadRequestException(error.message);
        }
        throw new common_1.BadRequestException("No se pudo guardar el producto.");
    }
};
exports.ProductsService = ProductsService;
exports.ProductsService = ProductsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ProductsService);
//# sourceMappingURL=products.service.js.map