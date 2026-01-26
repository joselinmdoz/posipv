import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { WarehousesService } from "./warehouses.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { IsOptional, IsString, MinLength } from "class-validator";

class CreateWarehouseDto {
  @IsString() @MinLength(2) name!: string;
  @IsString() @MinLength(1) code!: string;
  @IsOptional() @IsString() type?: string;
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
}