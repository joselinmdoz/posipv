import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { CurrencyCode, PurchaseStatus } from "@prisma/client";
import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from "class-validator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Permissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { PurchasesService } from "./purchases.service";

class PurchaseItemDto {
  @IsString()
  productId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  qty!: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0.000001)
  cost?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0.000001)
  total?: number;
}

class CreatePurchaseDto {
  @IsString()
  warehouseId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  supplierName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  supplierDocument?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  documentNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  note?: string;

  @IsOptional()
  @IsEnum(CurrencyCode)
  currency?: CurrencyCode;

  @IsOptional()
  @IsEnum(PurchaseStatus)
  status?: PurchaseStatus;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items!: PurchaseItemDto[];
}

class UpdatePurchaseDto {
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  purchaseDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  supplierName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  supplierDocument?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  documentNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  note?: string;

  @IsOptional()
  @IsEnum(CurrencyCode)
  currency?: CurrencyCode;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items?: PurchaseItemDto[];
}

class VoidPurchaseDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

class ListPurchasesQueryDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() warehouseId?: string;
  @IsOptional() @IsEnum(PurchaseStatus) status?: PurchaseStatus;
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
  @IsOptional() @IsString() limit?: string;
}

@Controller("purchases")
@UseGuards(JwtAuthGuard)
export class PurchasesController {
  constructor(private readonly service: PurchasesService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions("purchases.view")
  list(@Query() query: ListPurchasesQueryDto) {
    return this.service.list(query);
  }

  @Get(":id")
  @UseGuards(PermissionsGuard)
  @Permissions("purchases.view")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions("purchases.manage")
  create(@Req() req: any, @Body() dto: CreatePurchaseDto) {
    return this.service.create(req.user.userId, dto);
  }

  @Put(":id")
  @UseGuards(PermissionsGuard)
  @Permissions("purchases.manage")
  update(@Param("id") id: string, @Body() dto: UpdatePurchaseDto) {
    return this.service.update(id, dto);
  }

  @Put(":id/confirm")
  @UseGuards(PermissionsGuard)
  @Permissions("purchases.manage")
  confirm(@Param("id") id: string) {
    return this.service.confirm(id);
  }

  @Put(":id/void")
  @UseGuards(PermissionsGuard)
  @Permissions("purchases.manage")
  void(@Param("id") id: string, @Body() dto: VoidPurchaseDto) {
    return this.service.void(id, dto.reason);
  }

  @Delete(":id")
  @UseGuards(PermissionsGuard)
  @Permissions("purchases.delete")
  remove(@Param("id") id: string) {
    return this.service.delete(id);
  }
}
