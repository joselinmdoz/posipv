import { Module } from '@nestjs/common';
import { InventoryReportsService } from './inventory-reports.service';
import { InventoryReportsController } from './inventory-reports.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [InventoryReportsService],
  controllers: [InventoryReportsController],
  exports: [InventoryReportsService],
})
export class InventoryReportsModule {}
