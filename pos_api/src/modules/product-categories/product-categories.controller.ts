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
import { ProductCategoriesService } from './product-categories.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@Controller('product-categories')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProductCategoriesController {
  constructor(private readonly productCategoriesService: ProductCategoriesService) {}

  @Get()
  @Permissions('products.view', 'products.manage')
  findAll() {
    return this.productCategoriesService.findAll();
  }

  @Get(':id')
  @Permissions('products.view', 'products.manage')
  findOne(@Param('id') id: string) {
    return this.productCategoriesService.findOne(id);
  }

  @Post()
  @Permissions('products.manage')
  create(@Body() data: { name: string; description?: string }) {
    return this.productCategoriesService.create(data);
  }

  @Put(':id')
  @Permissions('products.manage')
  update(
    @Param('id') id: string,
    @Body() data: { name?: string; description?: string; active?: boolean },
  ) {
    return this.productCategoriesService.update(id, data);
  }

  @Delete(':id')
  @Permissions('products.manage')
  delete(@Param('id') id: string) {
    return this.productCategoriesService.delete(id);
  }
}
