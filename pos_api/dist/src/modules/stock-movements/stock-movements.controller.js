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
exports.StockMovementsController = void 0;
const common_1 = require("@nestjs/common");
const stock_movements_service_1 = require("./stock-movements.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const class_validator_1 = require("class-validator");
class CreateStockMovementDto {
}
__decorate([
    (0, class_validator_1.IsEnum)(['IN', 'OUT', 'TRANSFER']),
    __metadata("design:type", String)
], CreateStockMovementDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateStockMovementDto.prototype, "productId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateStockMovementDto.prototype, "qty", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", Object)
], CreateStockMovementDto.prototype, "fromWarehouseId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", Object)
], CreateStockMovementDto.prototype, "toWarehouseId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], CreateStockMovementDto.prototype, "reason", void 0);
let StockMovementsController = class StockMovementsController {
    constructor(service) {
        this.service = service;
    }
    list(warehouseId, from, to) {
        return this.service.list({ warehouseId, from, to });
    }
    create(dto) {
        return this.service.create(dto);
    }
};
exports.StockMovementsController = StockMovementsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('warehouseId')),
    __param(1, (0, common_1.Query)('from')),
    __param(2, (0, common_1.Query)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], StockMovementsController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CreateStockMovementDto]),
    __metadata("design:returntype", void 0)
], StockMovementsController.prototype, "create", null);
exports.StockMovementsController = StockMovementsController = __decorate([
    (0, common_1.Controller)("stock-movements"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [stock_movements_service_1.StockMovementsService])
], StockMovementsController);
//# sourceMappingURL=stock-movements.controller.js.map