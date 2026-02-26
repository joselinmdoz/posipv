import { Body, Controller, Get, Param, Put, Query, UseGuards } from "@nestjs/common";
import { SettingsService } from "./settings.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString, Min } from "class-validator";

class PaymentMethodSettingDto {
  @IsString() code!: string;
  @IsString() name!: string;
  @IsBoolean() enabled!: boolean;
}

class DenominationSettingDto {
  @IsNumber() value!: number;
  @IsBoolean() enabled!: boolean;
}

class RegisterSettingsDto {
  @IsOptional() @IsNumber() defaultOpeningFloat?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() warehouseId?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) paymentMethods?: string[];
  // Compatibilidad: se aceptan números (legacy) u objetos { value, enabled }.
  @IsOptional() @IsArray() denominations?: Array<number | DenominationSettingDto>;
}

class SystemSettingsDto {
  @IsOptional() @IsString() @IsIn(["CUP", "USD"]) defaultCurrency?: "CUP" | "USD";
  @IsOptional() @IsArray() @ArrayMinSize(1) @IsString({ each: true }) @IsIn(["CUP", "USD"], { each: true }) enabledCurrencies?: Array<"CUP" | "USD">;
  @IsOptional() @IsNumber() @Min(0.000001) exchangeRateUsdToCup?: number;
}

@Controller("settings")
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private service: SettingsService) {}

  @Get("system")
  getSystemSettings() {
    return this.service.getSystemSettings();
  }

  @Put("system")
  saveSystemSettings(@Body() payload: SystemSettingsDto) {
    return this.service.saveSystemSettings(payload);
  }

  @Get("exchange-rates")
  listExchangeRates(@Query("limit") limit?: string) {
    return this.service.listExchangeRates(limit ? Number(limit) : 50);
  }

  @Get("register/:registerId")
  getRegisterSettings(@Param("registerId") registerId: string) {
    return this.service.getRegisterSettings(registerId);
  }

  @Put("register/:registerId")
  saveRegisterSettings(@Param("registerId") registerId: string, @Body() payload: RegisterSettingsDto) {
    return this.service.saveRegisterSettings(registerId, payload);
  }

  @Get("payment-methods")
  listPaymentMethods() {
    return this.service.listPaymentMethods();
  }

  @Put("payment-methods")
  savePaymentMethods(@Body() payload: PaymentMethodSettingDto[]) {
    return this.service.savePaymentMethods(payload);
  }

  @Get("denominations")
  listDenominations() {
    return this.service.listDenominations();
  }

  @Put("denominations")
  saveDenominations(@Body() payload: DenominationSettingDto[]) {
    return this.service.saveDenominations(payload);
  }
}
