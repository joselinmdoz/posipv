import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { WarehousesService } from "./warehouses.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { IsOptional, IsString, MinLength } from "class-validator";
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

@Controller("warehouses")
@UseGuards(JwtAuthGuard)
export class WarehousesController {
  constructor(private service: WarehousesService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  create(@Body() dto: CreateWarehouseDto) {
    return this.service.create(dto);
  }

  @Get(":id/stock")
  getStock(@Param("id") warehouseId: string) {
    return this.service.getStock(warehouseId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: { name?: string; code?: string; type?: 'CENTRAL' | 'TPV'; active?: boolean }) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @Permissions("warehouses.delete")
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }

  @Post(':id/reset-stock')
  @UseGuards(PermissionsGuard)
  @Permissions("warehouses.reset-stock")
  resetStock(@Param('id') id: string, @Body() dto: ResetStockDto) {
    return this.service.resetStock(id, dto.reason);
  }
}
