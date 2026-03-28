import { Body, Controller, Get, Param, Put, Query, UseGuards } from "@nestjs/common";
import { SettingsService } from "./settings.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { Permissions } from "../auth/permissions.decorator";

class PaymentMethodSettingDto {
  @IsString() code!: string;
  @IsString() name!: string;
  @IsBoolean() enabled!: boolean;
}

class DenominationSettingDto {
  @IsNumber() value!: number;
  @IsBoolean() enabled!: boolean;
  @IsOptional() @IsString() @IsIn(["CUP", "USD"]) currency?: "CUP" | "USD";
}

class RegisterSettingsDto {
  @IsOptional() @IsNumber() defaultOpeningFloat?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() warehouseId?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) sellerEmployeeIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) paymentMethods?: string[];
  // Compatibilidad: se aceptan números (legacy) u objetos { value, enabled }.
  @IsOptional() @IsArray() denominations?: Array<number | DenominationSettingDto>;
}

class SystemSettingsDto {
  @IsOptional() @IsString() @IsIn(["CUP", "USD"]) defaultCurrency?: "CUP" | "USD";
  @IsOptional() @IsArray() @ArrayMinSize(1) @IsString({ each: true }) @IsIn(["CUP", "USD"], { each: true }) enabledCurrencies?: Array<"CUP" | "USD">;
  @IsOptional() @IsNumber() @Min(0.000001) exchangeRateUsdToCup?: number;
  @IsOptional() @IsString() @MaxLength(120) systemName?: string;
  @IsOptional() @IsString() @MaxLength(1000000) systemLogoUrl?: string;
}

@Controller("settings")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SettingsController {
  constructor(private service: SettingsService) {}

  @Get("system")
  @Permissions(
    "settings.manage",
    "products.view",
    "products.manage",
    "purchases.view",
    "purchases.manage",
    "sales.tpv",
    "sales.direct",
    "tpv.manage",
    "reports.view",
    "dashboard.view",
  )
  getSystemSettings() {
    return this.service.getSystemSettings();
  }

  @Put("system")
  @Permissions("settings.manage")
  saveSystemSettings(@Body() payload: SystemSettingsDto) {
    return this.service.saveSystemSettings(payload);
  }

  @Get("exchange-rates")
  @Permissions("settings.manage")
  listExchangeRates(@Query("limit") limit?: string) {
    return this.service.listExchangeRates(limit ? Number(limit) : 50);
  }

  @Get("register/:registerId")
  @Permissions("sales.tpv", "tpv.manage", "settings.manage")
  getRegisterSettings(@Param("registerId") registerId: string) {
    return this.service.getRegisterSettings(registerId);
  }

  @Put("register/:registerId")
  @Permissions("tpv.manage", "settings.manage")
  saveRegisterSettings(@Param("registerId") registerId: string, @Body() payload: RegisterSettingsDto) {
    return this.service.saveRegisterSettings(registerId, payload);
  }

  @Get("payment-methods")
  @Permissions("sales.tpv", "tpv.manage", "settings.manage")
  listPaymentMethods() {
    return this.service.listPaymentMethods();
  }

  @Put("payment-methods")
  @Permissions("tpv.manage", "settings.manage")
  savePaymentMethods(@Body() payload: PaymentMethodSettingDto[]) {
    return this.service.savePaymentMethods(payload);
  }

  @Get("denominations")
  @Permissions("sales.tpv", "tpv.manage", "settings.manage")
  listDenominations(
    @Query("registerId") registerId?: string,
    @Query("currency") currency?: "CUP" | "USD",
  ) {
    return this.service.listDenominations({ registerId, currency });
  }

  @Put("denominations")
  @Permissions("tpv.manage", "settings.manage")
  saveDenominations(@Body() payload: DenominationSettingDto[]) {
    return this.service.saveDenominations(payload);
  }
}
