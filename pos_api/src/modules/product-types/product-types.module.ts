import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ProductTypesService } from './product-types.service';
import { ProductTypesController } from './product-types.controller';

@Module({
  imports: [PrismaModule],
  providers: [ProductTypesService],
  controllers: [ProductTypesController],
  exports: [ProductTypesService],
})
export class ProductTypesModule {}
