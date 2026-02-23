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
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('measurement-unit-types')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MeasurementUnitTypesController {
  constructor(private readonly measurementUnitTypesService: MeasurementUnitTypesService) {}

  @Get()
  @Roles('ADMIN', 'CASHIER')
  findAll() {
    return this.measurementUnitTypesService.findAll();
  }

  @Get(':id')
  @Roles('ADMIN', 'CASHIER')
  findOne(@Param('id') id: string) {
    return this.measurementUnitTypesService.findOne(id);
  }

  @Post()
  @Roles('ADMIN')
  create(@Body() data: { name: string; description?: string }) {
    return this.measurementUnitTypesService.create(data);
  }

  @Put(':id')
  @Roles('ADMIN')
  update(
    @Param('id') id: string,
    @Body() data: { name?: string; description?: string; active?: boolean },
  ) {
    return this.measurementUnitTypesService.update(id, data);
  }

  @Delete(':id')
  @Roles('ADMIN')
  delete(@Param('id') id: string) {
    return this.measurementUnitTypesService.delete(id);
  }
}
