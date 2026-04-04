import { Module } from "@nestjs/common";
import { PurchasesController } from "./purchases.controller";
import { PurchasesService } from "./purchases.service";
import { InventoryCostingModule } from "../inventory-costing/inventory-costing.module";

@Module({
  imports: [InventoryCostingModule],
  controllers: [PurchasesController],
  providers: [PurchasesService],
})
export class PurchasesModule {}
