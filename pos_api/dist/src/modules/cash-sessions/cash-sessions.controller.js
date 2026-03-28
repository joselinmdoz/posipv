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
exports.CashSessionsController = void 0;
const common_1 = require("@nestjs/common");
const cash_sessions_service_1 = require("./cash-sessions.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const class_validator_1 = require("class-validator");
const permissions_guard_1 = require("../auth/permissions.guard");
const permissions_decorator_1 = require("../auth/permissions.decorator");
class OpenDto {
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OpenDto.prototype, "registerId", void 0);
__decorate([
    (0, class_validator_1.IsNumberString)(),
    __metadata("design:type", String)
], OpenDto.prototype, "openingAmount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OpenDto.prototype, "note", void 0);
class CloseDto {
}
__decorate([
    (0, class_validator_1.IsNumberString)(),
    __metadata("design:type", String)
], CloseDto.prototype, "closingAmount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CloseDto.prototype, "note", void 0);
let CashSessionsController = class CashSessionsController {
    constructor(service) {
        this.service = service;
    }
    list() {
        return this.service.findAll();
    }
    getOpen(registerId) {
        return this.service.getOpenByRegister(registerId);
    }
    getSummary(id) {
        return this.service.getSessionSummary(id);
    }
    getOne(id) {
        return this.service.findOne(id);
    }
    open(req, dto) {
        return this.service.open({
            registerId: dto.registerId,
            openingAmount: dto.openingAmount,
            note: dto.note,
            openedById: req.user.userId,
        });
    }
    close(id, dto) {
        return this.service.close(id, dto.closingAmount, dto.note);
    }
};
exports.CashSessionsController = CashSessionsController;
__decorate([
    (0, common_1.Get)(),
    (0, permissions_decorator_1.Permissions)("sales.tpv", "tpv.manage", "reports.view"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CashSessionsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)("open"),
    (0, permissions_decorator_1.Permissions)("sales.tpv", "tpv.manage", "reports.view"),
    __param(0, (0, common_1.Query)("registerId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CashSessionsController.prototype, "getOpen", null);
__decorate([
    (0, common_1.Get)(":id/summary"),
    (0, permissions_decorator_1.Permissions)("sales.tpv", "tpv.manage", "reports.view"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CashSessionsController.prototype, "getSummary", null);
__decorate([
    (0, common_1.Get)(":id"),
    (0, permissions_decorator_1.Permissions)("sales.tpv", "tpv.manage", "reports.view"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CashSessionsController.prototype, "getOne", null);
__decorate([
    (0, common_1.Post)("open"),
    (0, permissions_decorator_1.Permissions)("sales.tpv", "tpv.manage"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, OpenDto]),
    __metadata("design:returntype", void 0)
], CashSessionsController.prototype, "open", null);
__decorate([
    (0, common_1.Post)(":id/close"),
    (0, permissions_decorator_1.Permissions)("sales.tpv", "tpv.manage"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, CloseDto]),
    __metadata("design:returntype", void 0)
], CashSessionsController.prototype, "close", null);
exports.CashSessionsController = CashSessionsController = __decorate([
    (0, common_1.Controller)("cash-sessions"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [cash_sessions_service_1.CashSessionsService])
], CashSessionsController);
//# sourceMappingURL=cash-sessions.controller.js.map