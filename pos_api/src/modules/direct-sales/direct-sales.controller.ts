import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { DirectSalesService } from "./direct-sales.service";
import { Type } from "class-transformer";
import { IsArray, IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from "class-validator";
import { CurrencyCode, PaymentMethod } from "@prisma/client";
import { PermissionsGuard } from "../auth/permissions.guard";
import { Permissions } from "../auth/permissions.decorator";

class DirectSaleItemDto {
  @IsString() productId!: string;
  @Type(() => Number)
  @IsNumber() @Min(0.001) qty!: number;
}

class DirectSalePaymentDto {
  @IsEnum(PaymentMethod) method!: PaymentMethod;
  @IsOptional() @IsString() amount?: string;
  @IsOptional() @IsString() amountOriginal?: string;
  @IsOptional() @IsEnum(CurrencyCode) currency?: CurrencyCode;
  @IsOptional() @IsString() transactionCode?: string;
}

class CreateDirectSaleDto {
  @IsString() warehouseId!: string;
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() @MaxLength(120) customerName?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DirectSaleItemDto)
  items!: DirectSaleItemDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DirectSalePaymentDto)
  payments!: DirectSalePaymentDto[];
}

@Controller("direct-sales")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DirectSalesController {
  constructor(private readonly service: DirectSalesService) {}

  @Get("warehouse/:warehouseId/products")
  @Permissions("sales.direct")
  listWarehouseProducts(@Param("warehouseId") warehouseId: string) {
    return this.service.listWarehouseProducts(warehouseId);
  }

  @Post()
  @Permissions("sales.direct")
  create(@Req() req: any, @Body() dto: CreateDirectSaleDto) {
    return this.service.createDirectSale(req.user.userId, dto);
  }

  @Get(":saleId/ticket")
  @Permissions("sales.direct")
  getTicket(@Param("saleId") saleId: string) {
    return this.service.getTicket(saleId);
  }
}
