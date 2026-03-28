import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { MeasurementUnitsService } from './measurement-units.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@Controller('measurement-units')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MeasurementUnitsController {
  constructor(private readonly measurementUnitsService: MeasurementUnitsService) {}

  @Get()
  @Permissions('products.view', 'products.manage')
  findAll() {
    return this.measurementUnitsService.findAll();
  }

  @Get(':id')
  @Permissions('products.view', 'products.manage')
  findOne(@Param('id') id: string) {
    return this.measurementUnitsService.findOne(id);
  }

  @Post()
  @Permissions('products.manage')
  create(@Body() data: { name: string; symbol: string; typeId?: string }) {
    return this.measurementUnitsService.create(data);
  }

  @Put(':id')
  @Permissions('products.manage')
  update(
    @Param('id') id: string,
    @Body() data: { name?: string; symbol?: string; typeId?: string; active?: boolean },
  ) {
    return this.measurementUnitsService.update(id, data);
  }

  @Delete(':id')
  @Permissions('products.manage')
  delete(@Param('id') id: string) {
    return this.measurementUnitsService.delete(id);
  }
}
