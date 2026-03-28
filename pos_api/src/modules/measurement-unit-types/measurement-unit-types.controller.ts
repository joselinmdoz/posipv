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
import { MeasurementUnitTypesService } from './measurement-unit-types.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@Controller('measurement-unit-types')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MeasurementUnitTypesController {
  constructor(private readonly measurementUnitTypesService: MeasurementUnitTypesService) {}

  @Get()
  @Permissions('products.view', 'products.manage')
  findAll() {
    return this.measurementUnitTypesService.findAll();
  }

  @Get(':id')
  @Permissions('products.view', 'products.manage')
  findOne(@Param('id') id: string) {
    return this.measurementUnitTypesService.findOne(id);
  }

  @Post()
  @Permissions('products.manage')
  create(@Body() data: { name: string; description?: string }) {
    return this.measurementUnitTypesService.create(data);
  }

  @Put(':id')
  @Permissions('products.manage')
  update(
    @Param('id') id: string,
    @Body() data: { name?: string; description?: string; active?: boolean },
  ) {
    return this.measurementUnitTypesService.update(id, data);
  }

  @Delete(':id')
  @Permissions('products.manage')
  delete(@Param('id') id: string) {
    return this.measurementUnitTypesService.delete(id);
  }
}
