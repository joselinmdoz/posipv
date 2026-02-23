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
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('measurement-units')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MeasurementUnitsController {
  constructor(private readonly measurementUnitsService: MeasurementUnitsService) {}

  @Get()
  @Roles('ADMIN', 'CASHIER')
  findAll() {
    return this.measurementUnitsService.findAll();
  }

  @Get(':id')
  @Roles('ADMIN', 'CASHIER')
  findOne(@Param('id') id: string) {
    return this.measurementUnitsService.findOne(id);
  }

  @Post()
  @Roles('ADMIN')
  create(@Body() data: { name: string; symbol: string; typeId?: string }) {
    return this.measurementUnitsService.create(data);
  }

  @Put(':id')
  @Roles('ADMIN')
  update(
    @Param('id') id: string,
    @Body() data: { name?: string; symbol?: string; typeId?: string; active?: boolean },
  ) {
    return this.measurementUnitsService.update(id, data);
  }

  @Delete(':id')
  @Roles('ADMIN')
  delete(@Param('id') id: string) {
    return this.measurementUnitsService.delete(id);
  }
}
