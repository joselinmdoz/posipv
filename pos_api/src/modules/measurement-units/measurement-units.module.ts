import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MeasurementUnitsService } from './measurement-units.service';
import { MeasurementUnitsController } from './measurement-units.controller';

@Module({
  imports: [PrismaModule],
  providers: [MeasurementUnitsService],
  controllers: [MeasurementUnitsController],
  exports: [MeasurementUnitsService],
})
export class MeasurementUnitsModule {}
