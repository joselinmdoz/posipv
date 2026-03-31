import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { LicenseController } from "./license.controller";
import { LicenseGuard } from "./license.guard";
import { LicenseService } from "./license.service";

@Module({
  controllers: [LicenseController],
  providers: [
    LicenseService,
    {
      provide: APP_GUARD,
      useClass: LicenseGuard,
    },
  ],
  exports: [LicenseService],
})
export class LicenseModule {}
