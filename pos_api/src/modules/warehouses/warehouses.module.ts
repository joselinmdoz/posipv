import { Module } from "@nestjs/common";
import { WarehousesService } from "./warehouses.service";
import { WarehousesController } from "./warehouses.controller";
import { InventoryCostingModule } from "../inventory-costing/inventory-costing.module";

@Module({
  imports: [InventoryCostingModule],
  controllers: [WarehousesController],
  providers: [WarehousesService],
})
export class WarehousesModule {}
