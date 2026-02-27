import { Module } from "@nestjs/common";
import { SettingsModule } from "../settings/settings.module";
import { DirectSalesController } from "./direct-sales.controller";
import { DirectSalesService } from "./direct-sales.service";

@Module({
  imports: [SettingsModule],
  controllers: [DirectSalesController],
  providers: [DirectSalesService],
})
export class DirectSalesModule {}
