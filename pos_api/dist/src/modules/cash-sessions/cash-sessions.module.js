"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CashSessionsModule = void 0;
const common_1 = require("@nestjs/common");
const cash_sessions_controller_1 = require("./cash-sessions.controller");
const cash_sessions_service_1 = require("./cash-sessions.service");
const inventory_reports_module_1 = require("../inventory-reports/inventory-reports.module");
const stock_movements_module_1 = require("../stock-movements/stock-movements.module");
let CashSessionsModule = class CashSessionsModule {
};
exports.CashSessionsModule = CashSessionsModule;
exports.CashSessionsModule = CashSessionsModule = __decorate([
    (0, common_1.Module)({
        imports: [inventory_reports_module_1.InventoryReportsModule, stock_movements_module_1.StockMovementsModule],
        controllers: [cash_sessions_controller_1.CashSessionsController],
        providers: [cash_sessions_service_1.CashSessionsService],
    })
], CashSessionsModule);
//# sourceMappingURL=cash-sessions.module.js.map