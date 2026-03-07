import { Module } from "@nestjs/common";
import { SettingsModule } from "../settings/settings.module";
import { DirectSalesController } from "./direct-sales.controller";
import { DirectSalesService } from "./direct-sales.service";
import { AccountingModule } from "../accounting/accounting.module";

@Module({
  imports: [SettingsModule, AccountingModule],
  controllers: [DirectSalesController],
  providers: [DirectSalesService],
})
export class DirectSalesModule {}
