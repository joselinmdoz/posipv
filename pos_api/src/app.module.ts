import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ServeStaticModule } from "@nestjs/serve-static";
import { join } from "path";
import * as path from "path";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { RegistersModule } from "./modules/registers/registers.module";
import { CashSessionsModule } from "./modules/cash-sessions/cash-sessions.module";
import { ProductsModule } from "./modules/products/products.module";
import { SalesModule } from "./modules/sales/sales.module";
import { HealthModule } from "./modules/health/health.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { WarehousesModule } from "./modules/warehouses/warehouses.module";
import { StockMovementsModule } from "./modules/stock-movements/stock-movements.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { InventoryReportsModule } from "./modules/inventory-reports/inventory-reports.module";
import { ProductTypesModule } from "./modules/product-types/product-types.module";
import { ProductCategoriesModule } from "./modules/product-categories/product-categories.module";
import { MeasurementUnitTypesModule } from "./modules/measurement-unit-types/measurement-unit-types.module";
import { MeasurementUnitsModule } from "./modules/measurement-units/measurement-units.module";
import { DirectSalesModule } from "./modules/direct-sales/direct-sales.module";
import { CustomersModule } from "./modules/customers/customers.module";
import { EmployeesModule } from "./modules/employees/employees.module";
import { UserPermissionsModule } from "./modules/user-permissions/user-permissions.module";
import { AccountingModule } from "./modules/accounting/accounting.module";
import { PurchasesModule } from "./modules/purchases/purchases.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ServeStaticModule.forRoot({
      rootPath: path.resolve(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    RegistersModule,
    CashSessionsModule,
    ProductsModule,
    SalesModule,
    HealthModule,
    DashboardModule,
    ReportsModule,
    WarehousesModule,
    StockMovementsModule,
    SettingsModule,
    InventoryReportsModule,
    ProductTypesModule,
    ProductCategoriesModule,
    MeasurementUnitTypesModule,
    MeasurementUnitsModule,
    DirectSalesModule,
    CustomersModule,
    EmployeesModule,
    UserPermissionsModule,
    AccountingModule,
    PurchasesModule,
  ],
})
export class AppModule {}
