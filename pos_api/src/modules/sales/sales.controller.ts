import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { SalesService } from "./sales.service";
import { IsArray, IsEnum, IsInt, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { CurrencyCode, PaymentMethod } from "@prisma/client";

class ItemDto {
  @IsString() productId!: string;
  @IsInt() @Min(1) qty!: number;
}

class PayDto {
  @IsEnum(PaymentMethod) method!: PaymentMethod;
  @IsOptional() @IsString() amount?: string; // compat: monto en moneda base
  @IsOptional() @IsString() amountOriginal?: string; // monto digitado en moneda de la línea
  @IsOptional() @IsEnum(CurrencyCode) currency?: CurrencyCode;
}

class CreateSaleDto {
  @IsString() cashSessionId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  items!: ItemDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PayDto)
  payments!: PayDto[];
}

@Controller("sales")
@UseGuards(JwtAuthGuard)
export class SalesController {
  constructor(private service: SalesService) {}

  @Get("session/:cashSessionId/products")
  listSessionProducts(@Param("cashSessionId") cashSessionId: string) {
    return this.service.listSessionProducts(cashSessionId);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateSaleDto) {
    return this.service.createSale(req.user.userId, dto);
  }
}
