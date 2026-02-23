import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MeasurementUnitTypesService } from './measurement-unit-types.service';
import { MeasurementUnitTypesController } from './measurement-unit-types.controller';

@Module({
  imports: [PrismaModule],
  providers: [MeasurementUnitTypesService],
  controllers: [MeasurementUnitTypesController],
  exports: [MeasurementUnitTypesService],
})
export class MeasurementUnitTypesModule {}
