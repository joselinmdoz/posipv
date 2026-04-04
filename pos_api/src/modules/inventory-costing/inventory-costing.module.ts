import { Module } from "@nestjs/common";
import { InventoryCostingService } from "./inventory-costing.service";

@Module({
  providers: [InventoryCostingService],
  exports: [InventoryCostingService],
})
export class InventoryCostingModule {}

