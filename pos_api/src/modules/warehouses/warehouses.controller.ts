import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { WarehousesService } from "./warehouses.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { IsNumber, IsOptional, IsString, MinLength } from "class-validator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { Permissions } from "../auth/permissions.decorator";

class CreateWarehouseDto {
  @IsString() @MinLength(2) name!: string;
  @IsString() @MinLength(1) code!: string;
  @IsOptional() @IsString() type?: string;
}

class ResetStockDto {
  @IsOptional() @IsString() reason?: string;
}

class UpdateStockQtyDto {
  @IsNumber() qty!: number;
  @IsOptional() @IsString() reason?: string;
}

@Controller("warehouses")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WarehousesController {
  constructor(private service: WarehousesService) {}

  @Get()
  @Permissions(
    "warehouses.view",
    "reports.view",
    "sales.direct",
    "purchases.view",
    "purchases.manage",
    "sales.tpv",
    "tpv.manage",
  )
  list() {
    return this.service.list();
  }

  @Post()
  @Permissions("warehouses.manage")
  create(@Body() dto: CreateWarehouseDto) {
    return this.service.create(dto);
  }

  @Get(":id/stock")
  @Permissions(
    "warehouses.view",
    "reports.view",
    "sales.direct",
    "purchases.view",
    "purchases.manage",
    "sales.tpv",
    "tpv.manage",
  )
  getStock(@Param("id") warehouseId: string) {
    return this.service.getStock(warehouseId);
  }

  @Put(":id/stock/:productId")
  @Permissions("warehouses.manage", "stock-movements.manage")
  updateStockQty(
    @Param("id") warehouseId: string,
    @Param("productId") productId: string,
    @Body() dto: UpdateStockQtyDto,
  ) {
    return this.service.updateStockQty(warehouseId, productId, dto.qty, dto.reason);
  }

  @Delete(":id/stock/:productId")
  @Permissions("warehouses.delete", "warehouses.manage")
  removeStockItem(
    @Param("id") warehouseId: string,
    @Param("productId") productId: string,
    @Query("reason") reason?: string,
  ) {
    return this.service.removeStockItem(warehouseId, productId, reason);
  }

  @Get(':id')
  @Permissions(
    "warehouses.view",
    "reports.view",
    "sales.direct",
    "purchases.view",
    "purchases.manage",
    "sales.tpv",
    "tpv.manage",
  )
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @Permissions("warehouses.manage")
  update(@Param('id') id: string, @Body() dto: { name?: string; code?: string; type?: 'CENTRAL' | 'TPV'; active?: boolean }) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Permissions("warehouses.delete")
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }

  @Post(':id/reset-stock')
  @Permissions("warehouses.reset-stock")
  resetStock(@Param('id') id: string, @Body() dto: ResetStockDto) {
    return this.service.resetStock(id, dto.reason);
  }
}
