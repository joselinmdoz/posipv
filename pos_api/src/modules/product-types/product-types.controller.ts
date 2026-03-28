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
import { ProductTypesService } from './product-types.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@Controller('product-types')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProductTypesController {
  constructor(private readonly productTypesService: ProductTypesService) {}

  @Get()
  @Permissions('products.view', 'products.manage')
  findAll() {
    return this.productTypesService.findAll();
  }

  @Get(':id')
  @Permissions('products.view', 'products.manage')
  findOne(@Param('id') id: string) {
    return this.productTypesService.findOne(id);
  }

  @Post()
  @Permissions('products.manage')
  create(@Body() data: { name: string; description?: string }) {
    return this.productTypesService.create(data);
  }

  @Put(':id')
  @Permissions('products.manage')
  update(
    @Param('id') id: string,
    @Body() data: { name?: string; description?: string; active?: boolean },
  ) {
    return this.productTypesService.update(id, data);
  }

  @Delete(':id')
  @Permissions('products.manage')
  delete(@Param('id') id: string) {
    return this.productTypesService.delete(id);
  }
}
