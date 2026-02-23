import { Module } from "@nestjs/common";
import { CashSessionsController } from "./cash-sessions.controller";
import { CashSessionsService } from "./cash-sessions.service";
import { InventoryReportsModule } from "../inventory-reports/inventory-reports.module";

@Module({
  imports: [InventoryReportsModule],
  controllers: [CashSessionsController],
  providers: [CashSessionsService],
})
export class CashSessionsModule {}
