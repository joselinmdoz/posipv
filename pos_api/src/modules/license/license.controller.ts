import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { IsString, MaxLength, MinLength } from "class-validator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../auth/permissions.guard";
import { Permissions } from "../auth/permissions.decorator";
import { LicenseService } from "./license.service";

class ActivateLicenseDto {
  @IsString()
  @MaxLength(1024 * 1024)
  license!: string;
}

class KeyPemReadDto {
  @IsString()
  @MinLength(4)
  @MaxLength(128)
  password!: string;
}

class KeyPemUpdateDto extends KeyPemReadDto {
  @IsString()
  @MinLength(32)
  @MaxLength(16_384)
  publicKeyPem!: string;
}

@Controller("license")
@UseGuards(JwtAuthGuard)
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}

  @Get("status")
  status(@Query("refresh") refresh?: string) {
    return this.licenseService.getLicenseStatus(refresh === "1" || refresh === "true");
  }

  @Get("activation-request")
  @UseGuards(PermissionsGuard)
  @Permissions("settings.manage")
  activationRequest() {
    return this.licenseService.buildActivationRequest();
  }

  @Post("activate")
  @UseGuards(PermissionsGuard)
  @Permissions("settings.manage")
  activate(@Body() dto: ActivateLicenseDto) {
    return this.licenseService.activateLicense(dto.license);
  }

  @Post("keypem/read")
  @UseGuards(PermissionsGuard)
  @Permissions("settings.manage")
  readPublicKey(@Body() dto: KeyPemReadDto) {
    return this.licenseService.getCurrentPublicKeyPem(dto.password);
  }

  @Post("keypem/update")
  @UseGuards(PermissionsGuard)
  @Permissions("settings.manage")
  updatePublicKey(@Body() dto: KeyPemUpdateDto) {
    return this.licenseService.setCurrentPublicKeyPem(dto.password, dto.publicKeyPem);
  }
}
