"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const serve_static_1 = require("@nestjs/serve-static");
const path = require("path");
const prisma_module_1 = require("./prisma/prisma.module");
const auth_module_1 = require("./modules/auth/auth.module");
const users_module_1 = require("./modules/users/users.module");
const registers_module_1 = require("./modules/registers/registers.module");
const cash_sessions_module_1 = require("./modules/cash-sessions/cash-sessions.module");
const products_module_1 = require("./modules/products/products.module");
const sales_module_1 = require("./modules/sales/sales.module");
const health_module_1 = require("./modules/health/health.module");
const dashboard_module_1 = require("./modules/dashboard/dashboard.module");
const reports_module_1 = require("./modules/reports/reports.module");
const warehouses_module_1 = require("./modules/warehouses/warehouses.module");
const stock_movements_module_1 = require("./modules/stock-movements/stock-movements.module");
const settings_module_1 = require("./modules/settings/settings.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            serve_static_1.ServeStaticModule.forRoot({
                rootPath: path.resolve(process.cwd(), 'uploads'),
                serveRoot: '/uploads',
            }),
            prisma_module_1.PrismaModule,
            users_module_1.UsersModule,
            auth_module_1.AuthModule,
            registers_module_1.RegistersModule,
            cash_sessions_module_1.CashSessionsModule,
            products_module_1.ProductsModule,
            sales_module_1.SalesModule,
            health_module_1.HealthModule,
            dashboard_module_1.DashboardModule,
            reports_module_1.ReportsModule,
            warehouses_module_1.WarehousesModule,
            stock_movements_module_1.StockMovementsModule,
            settings_module_1.SettingsModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map