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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const products_service_1 = require("./products.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const class_validator_1 = require("class-validator");
const multer_1 = require("multer");
const path_1 = require("path");
const client_1 = require("@prisma/client");
const permissions_guard_1 = require("../auth/permissions.guard");
const permissions_decorator_1 = require("../auth/permissions.decorator");
class CreateProductDto {
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    __metadata("design:type", String)
], CreateProductDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateProductDto.prototype, "codigo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateProductDto.prototype, "barcode", void 0);
__decorate([
    (0, class_validator_1.IsNumberString)(),
    __metadata("design:type", String)
], CreateProductDto.prototype, "price", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumberString)(),
    __metadata("design:type", String)
], CreateProductDto.prototype, "cost", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumberString)(),
    __metadata("design:type", String)
], CreateProductDto.prototype, "lowStockAlertQty", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], CreateProductDto.prototype, "allowFractionalQty", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.CurrencyCode),
    __metadata("design:type", String)
], CreateProductDto.prototype, "currency", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateProductDto.prototype, "image", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateProductDto.prototype, "productTypeId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateProductDto.prototype, "productCategoryId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateProductDto.prototype, "measurementUnitId", void 0);
const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const productImageUploadOptions = {
    storage: (0, multer_1.diskStorage)({
        destination: "./uploads",
        filename: (req, file, callback) => {
            const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
            callback(null, `${file.fieldname}-${uniqueSuffix}${(0, path_1.extname)(file.originalname)}`);
        },
    }),
    limits: {
        fileSize: PRODUCT_IMAGE_MAX_BYTES,
    },
};
let ProductsController = class ProductsController {
    constructor(service) {
        this.service = service;
    }
    list(includeInactive) {
        const includeAll = ["1", "true", "yes"].includes(String(includeInactive || "").toLowerCase());
        return this.service.list(includeAll);
    }
    create(req, file) {
        const dto = {
            name: req.body.name,
            price: req.body.price,
            codigo: req.body.codigo,
            barcode: req.body.barcode,
            cost: req.body.cost,
            lowStockAlertQty: req.body.lowStockAlertQty,
            currency: req.body.currency,
            productTypeId: req.body.productTypeId,
            productCategoryId: req.body.productCategoryId,
            measurementUnitId: req.body.measurementUnitId,
        };
        if (req.body.allowFractionalQty !== undefined) {
            dto.allowFractionalQty = req.body.allowFractionalQty === 'true' || req.body.allowFractionalQty === true;
        }
        if (file) {
            dto.image = `/uploads/${file.filename}`;
        }
        return this.service.create(dto);
    }
    update(id, req, file) {
        const dto = {
            name: req.body.name,
            price: req.body.price,
            codigo: req.body.codigo,
            barcode: req.body.barcode,
            cost: req.body.cost,
            lowStockAlertQty: req.body.lowStockAlertQty,
            currency: req.body.currency,
            productTypeId: req.body.productTypeId,
            productCategoryId: req.body.productCategoryId,
            measurementUnitId: req.body.measurementUnitId,
        };
        if (req.body.active !== undefined) {
            dto.active = req.body.active === 'true';
        }
        if (req.body.allowFractionalQty !== undefined) {
            dto.allowFractionalQty = req.body.allowFractionalQty === 'true' || req.body.allowFractionalQty === true;
        }
        if (file) {
            dto.image = `/uploads/${file.filename}`;
        }
        else if (req.body.existingImage) {
            dto.image = req.body.existingImage;
        }
        return this.service.update(id, dto);
    }
    findOne(id) {
        return this.service.findOne(id);
    }
    delete(id) {
        return this.service.delete(id);
    }
};
exports.ProductsController = ProductsController;
__decorate([
    (0, common_1.Get)(),
    (0, permissions_decorator_1.Permissions)("products.view", "products.manage", "purchases.view", "purchases.manage", "warehouses.view", "sales.tpv"),
    __param(0, (0, common_1.Query)("includeInactive")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, permissions_decorator_1.Permissions)("products.manage"),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)("image", productImageUploadOptions)),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, permissions_decorator_1.Permissions)("products.manage"),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)("image", productImageUploadOptions)),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "update", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, permissions_decorator_1.Permissions)("products.view", "products.manage", "purchases.view", "purchases.manage", "warehouses.view"),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, permissions_decorator_1.Permissions)("products.manage"),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "delete", null);
exports.ProductsController = ProductsController = __decorate([
    (0, common_1.Controller)("products"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [products_service_1.ProductsService])
], ProductsController);
//# sourceMappingURL=products.controller.js.map