import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { StockMovementsService } from "./stock-movements.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { IsEnum, IsNumber, IsOptional, IsString } from "class-validator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { Permissions } from "../auth/permissions.decorator";

class CreateStockMovementDto {
  @IsEnum(['IN', 'OUT', 'TRANSFER']) type!: 'IN' | 'OUT' | 'TRANSFER';
  @IsString() productId!: string;
  @IsNumber() qty!: number;
  @IsOptional() @IsString() fromWarehouseId?: string | null;
  @IsOptional() @IsString() toWarehouseId?: string | null;
  @IsOptional() @IsString() reason?: string | null;
}

@Controller("stock-movements")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StockMovementsController {
  constructor(private service: StockMovementsService) {}

  @Get()
  @Permissions("warehouses.view")
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
  @Permissions("stock-movements.manage", "warehouses.manage")
  create(@Req() req: any, @Body() dto: CreateStockMovementDto) {
    return this.service.create(dto, req.user.userId);
  }

  @Delete(":id")
  @Permissions("stock-movements.delete")
  remove(@Req() req: any, @Param("id") movementId: string) {
    return this.service.delete(movementId, req.user.userId);
  }
}
