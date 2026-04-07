import { Module } from "@nestjs/common";
import { StockMovementsService } from "./stock-movements.service";
import { StockMovementsController } from "./stock-movements.controller";
import { AccountingModule } from "../accounting/accounting.module";
import { InventoryCostingModule } from "../inventory-costing/inventory-costing.module";

@Module({
  imports: [AccountingModule, InventoryCostingModule],
  controllers: [StockMovementsController],
  providers: [StockMovementsService],
  exports: [StockMovementsService],
})
export class StockMovementsModule {}
