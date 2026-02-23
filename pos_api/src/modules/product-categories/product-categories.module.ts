import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ProductCategoriesService } from './product-categories.service';
import { ProductCategoriesController } from './product-categories.controller';

@Module({
  imports: [PrismaModule],
  providers: [ProductCategoriesService],
  controllers: [ProductCategoriesController],
  exports: [ProductCategoriesService],
})
export class ProductCategoriesModule {}
