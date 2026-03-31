import { Module } from "@nestjs/common";
import { CashSessionsController } from "./cash-sessions.controller";
import { CashSessionsService } from "./cash-sessions.service";
import { InventoryReportsModule } from "../inventory-reports/inventory-reports.module";
import { StockMovementsModule } from "../stock-movements/stock-movements.module";

@Module({
  imports: [InventoryReportsModule, StockMovementsModule],
  controllers: [CashSessionsController],
  providers: [CashSessionsService],
})
export class CashSessionsModule {}
