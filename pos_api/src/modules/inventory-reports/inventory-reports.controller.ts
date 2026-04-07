import {
  Delete,
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { InventoryReportsService } from './inventory-reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

interface CreateReportDto {
  cashSessionId: string;
  warehouseId: string;
}

class ManualIvpLineDto {
  @IsString() productId!: string;
  @IsNumber() initial!: number;
  @IsNumber() entries!: number;
  @IsNumber() outs!: number;
  @IsNumber() sales!: number;
}

class SaveManualIvpDto {
  @IsString() registerId!: string;
  @IsString() reportDate!: string;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) employeeIds?: string[];
  @IsOptional() paymentBreakdown?: Record<string, number>;
  @IsArray() lines!: ManualIvpLineDto[];
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

  @Get('session/:cashSessionId/ipv')
  @Roles('ADMIN', 'CASHIER')
  async getSessionIpv(@Param('cashSessionId') cashSessionId: string) {
    return this.inventoryReportsService.getSessionIpvReport(cashSessionId);
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

  @Delete('session/:cashSessionId')
  @UseGuards(PermissionsGuard)
  @Roles('ADMIN', 'CASHIER')
  @Permissions('inventory-reports.delete')
  async removeBySession(@Param('cashSessionId') cashSessionId: string) {
    return this.inventoryReportsService.deleteBySession(cashSessionId);
  }

  @Get('manual')
  @UseGuards(PermissionsGuard)
  @Roles('ADMIN', 'CASHIER')
  @Permissions('reports.view', 'tpv.manage')
  async listManual(
    @Query('registerId') registerId?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.inventoryReportsService.listManualReports({
      registerId,
      warehouseId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Delete('manual/:id')
  @UseGuards(PermissionsGuard)
  @Roles('ADMIN', 'CASHIER')
  @Permissions('inventory-reports.delete')
  async removeManual(@Param('id') id: string) {
    return this.inventoryReportsService.deleteManual(id);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @Roles('ADMIN', 'CASHIER')
  @Permissions('inventory-reports.delete')
  async remove(@Param('id') id: string) {
    return this.inventoryReportsService.delete(id);
  }

  @Get('manual/registers')
  @UseGuards(PermissionsGuard)
  @Roles('ADMIN', 'CASHIER')
  @Permissions('reports.view', 'tpv.manage')
  async listManualRegisters() {
    return this.inventoryReportsService.listManualRegisters();
  }

  @Get('manual/bootstrap')
  @UseGuards(PermissionsGuard)
  @Roles('ADMIN', 'CASHIER')
  @Permissions('reports.view', 'tpv.manage')
  async getManualBootstrap(
    @Query('registerId') registerId: string,
    @Query('reportDate') reportDate?: string,
  ) {
    return this.inventoryReportsService.getManualBootstrap(registerId, reportDate);
  }

  @Get('manual/:id')
  @UseGuards(PermissionsGuard)
  @Roles('ADMIN', 'CASHIER')
  @Permissions('reports.view', 'tpv.manage')
  async findManualById(@Param('id') id: string) {
    return this.inventoryReportsService.findManualById(id);
  }

  @Post('manual')
  @UseGuards(PermissionsGuard)
  @Roles('ADMIN', 'CASHIER')
  @Permissions('tpv.manage')
  async createOrUpdateManual(@Req() req: any, @Body() dto: SaveManualIvpDto) {
    return this.inventoryReportsService.saveManualReport({
      ...dto,
      createdById: req.user?.userId || undefined,
    });
  }

  @Put('manual/:id')
  @UseGuards(PermissionsGuard)
  @Roles('ADMIN', 'CASHIER')
  @Permissions('tpv.manage')
  async updateManual(@Param('id') id: string, @Req() req: any, @Body() dto: SaveManualIvpDto) {
    return this.inventoryReportsService.saveManualReport({
      ...dto,
      id,
      createdById: req.user?.userId || undefined,
    });
  }

  // Debe declararse al final para evitar que esta ruta genérica capture paths como "/manual".
  @Get(':id')
  @Roles('ADMIN', 'CASHIER')
  async findOne(@Param('id') id: string) {
    return this.inventoryReportsService.findOne(id);
  }
}
