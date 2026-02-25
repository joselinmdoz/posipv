import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { StockMovementsService } from "./stock-movements.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { IsEnum, IsNumber, IsOptional, IsString } from "class-validator";

class CreateStockMovementDto {
  @IsEnum(['IN', 'OUT', 'TRANSFER']) type!: 'IN' | 'OUT' | 'TRANSFER';
  @IsString() productId!: string;
  @IsNumber() qty!: number;
  @IsOptional() @IsString() fromWarehouseId?: string | null;
  @IsOptional() @IsString() toWarehouseId?: string | null;
  @IsOptional() @IsString() reason?: string | null;
}

@Controller("stock-movements")
@UseGuards(JwtAuthGuard)
export class StockMovementsController {
  constructor(private service: StockMovementsService) {}

  @Get()
  list(
    @Query('warehouseId') warehouseId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('type') type?: 'IN' | 'OUT' | 'TRANSFER',
    @Query('reason') reason?: string,
  ) {
    return this.service.list({ warehouseId, from, to, type, reason });
  }

  @Post()
  create(@Body() dto: CreateStockMovementDto) {
    return this.service.create(dto);
  }
}
