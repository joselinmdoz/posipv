import { Module } from "@nestjs/common";
import { SettingsModule } from "../settings/settings.module";
import { DirectSalesController } from "./direct-sales.controller";
import { DirectSalesService } from "./direct-sales.service";
import { AccountingModule } from "../accounting/accounting.module";
import { InventoryCostingModule } from "../inventory-costing/inventory-costing.module";

@Module({
  imports: [SettingsModule, AccountingModule, InventoryCostingModule],
  controllers: [DirectSalesController],
  providers: [DirectSalesService],
})
export class DirectSalesModule {}
