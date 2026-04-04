import { Module } from "@nestjs/common";
import { SalesController } from "./sales.controller";
import { SalesService } from "./sales.service";
import { SettingsModule } from "../settings/settings.module";
import { AccountingModule } from "../accounting/accounting.module";
import { InventoryCostingModule } from "../inventory-costing/inventory-costing.module";

@Module({
  imports: [SettingsModule, AccountingModule, InventoryCostingModule],
  controllers: [SalesController],
  providers: [SalesService],
})
export class SalesModule {}
