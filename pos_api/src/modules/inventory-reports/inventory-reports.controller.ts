import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { InventoryReportsService } from './inventory-reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

interface CreateReportDto {
  cashSessionId: string;
  warehouseId: string;
}

@Controller('inventory-reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryReportsController {
  constructor(private readonly inventoryReportsService: InventoryReportsService) {}

  @Post('initial')
  @Roles('ADMIN', 'CASHIER')
  async createInitial(@Body() dto: CreateReportDto) {
    return this.inventoryReportsService.createInitial(dto.cashSessionId, dto.warehouseId);
  }

  @Post('final')
  @Roles('ADMIN', 'CASHIER')
  async createFinal(@Body() dto: CreateReportDto) {
    return this.inventoryReportsService.createFinal(dto.cashSessionId, dto.warehouseId);
  }

  @Get('session/:cashSessionId')
  @Roles('ADMIN', 'CASHIER')
  async findBySession(@Param('cashSessionId') cashSessionId: string) {
    return this.inventoryReportsService.findBySession(cashSessionId);
  }

  @Get('session/:cashSessionId/latest')
  @Roles('ADMIN', 'CASHIER')
  async getLatestBySession(
    @Param('cashSessionId') cashSessionId: string,
    @Query('type') type?: 'INITIAL' | 'FINAL',
  ) {
    return this.inventoryReportsService.getLatestBySession(cashSessionId, type);
  }

  @Get('warehouse/:warehouseId')
  @Roles('ADMIN', 'CASHIER')
  async findByWarehouse(
    @Param('warehouseId') warehouseId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.inventoryReportsService.findByWarehouse(
      warehouseId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get(':id')
  @Roles('ADMIN', 'CASHIER')
  async findOne(@Param('id') id: string) {
    return this.inventoryReportsService.findOne(id);
  }
}
