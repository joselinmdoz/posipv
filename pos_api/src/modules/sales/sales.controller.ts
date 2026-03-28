import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { SalesService } from "./sales.service";
import { IsArray, IsEnum, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { CurrencyCode, PaymentMethod } from "@prisma/client";
import { PermissionsGuard } from "../auth/permissions.guard";
import { Permissions } from "../auth/permissions.decorator";

class ItemDto {
  @IsString() productId!: string;
  @Type(() => Number)
  @IsNumber() @Min(0.001) qty!: number;
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
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SalesController {
  constructor(private service: SalesService) {}

  @Get("session/:cashSessionId/products")
  @Permissions("sales.tpv")
  listSessionProducts(@Param("cashSessionId") cashSessionId: string) {
    return this.service.listSessionProducts(cashSessionId);
  }

  @Post()
  @Permissions("sales.tpv")
  create(@Req() req: any, @Body() dto: CreateSaleDto) {
    return this.service.createSale(req.user.userId, dto);
  }

  @Delete(":id")
  @Permissions("sales.delete")
  remove(@Req() req: any, @Param("id") saleId: string) {
    return this.service.deleteSale(saleId, req.user.userId);
  }
}
