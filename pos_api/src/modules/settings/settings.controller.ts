import { Body, Controller, Get, Param, Put, UseGuards } from "@nestjs/common";
import { SettingsService } from "./settings.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString } from "class-validator";

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

@Controller("settings")
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private service: SettingsService) {}

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
