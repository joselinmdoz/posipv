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
exports.SettingsController = void 0;
const common_1 = require("@nestjs/common");
const settings_service_1 = require("./settings.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const class_validator_1 = require("class-validator");
class PaymentMethodSettingDto {
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PaymentMethodSettingDto.prototype, "code", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PaymentMethodSettingDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PaymentMethodSettingDto.prototype, "enabled", void 0);
class DenominationSettingDto {
}
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], DenominationSettingDto.prototype, "value", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], DenominationSettingDto.prototype, "enabled", void 0);
class RegisterSettingsDto {
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], RegisterSettingsDto.prototype, "defaultOpeningFloat", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RegisterSettingsDto.prototype, "currency", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RegisterSettingsDto.prototype, "warehouseId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], RegisterSettingsDto.prototype, "paymentMethods", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsNumber)({}, { each: true }),
    __metadata("design:type", Array)
], RegisterSettingsDto.prototype, "denominations", void 0);
let SettingsController = class SettingsController {
    constructor(service) {
        this.service = service;
    }
    getRegisterSettings(registerId) {
        return this.service.getRegisterSettings(registerId);
    }
    saveRegisterSettings(registerId, payload) {
        return this.service.saveRegisterSettings(registerId, payload);
    }
    listPaymentMethods() {
        return this.service.listPaymentMethods();
    }
    savePaymentMethods(payload) {
        return this.service.savePaymentMethods(payload);
    }
    listDenominations() {
        return this.service.listDenominations();
    }
    saveDenominations(payload) {
        return this.service.saveDenominations(payload);
    }
};
exports.SettingsController = SettingsController;
__decorate([
    (0, common_1.Get)("register/:registerId"),
    __param(0, (0, common_1.Param)("registerId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "getRegisterSettings", null);
__decorate([
    (0, common_1.Put)("register/:registerId"),
    __param(0, (0, common_1.Param)("registerId")),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, RegisterSettingsDto]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "saveRegisterSettings", null);
__decorate([
    (0, common_1.Get)("payment-methods"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "listPaymentMethods", null);
__decorate([
    (0, common_1.Put)("payment-methods"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "savePaymentMethods", null);
__decorate([
    (0, common_1.Get)("denominations"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "listDenominations", null);
__decorate([
    (0, common_1.Put)("denominations"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "saveDenominations", null);
exports.SettingsController = SettingsController = __decorate([
    (0, common_1.Controller)("settings"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [settings_service_1.SettingsService])
], SettingsController);
//# sourceMappingURL=settings.controller.js.map