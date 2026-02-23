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
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('product-types')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductTypesController {
  constructor(private readonly productTypesService: ProductTypesService) {}

  @Get()
  @Roles('ADMIN', 'CASHIER')
  findAll() {
    return this.productTypesService.findAll();
  }

  @Get(':id')
  @Roles('ADMIN', 'CASHIER')
  findOne(@Param('id') id: string) {
    return this.productTypesService.findOne(id);
  }

  @Post()
  @Roles('ADMIN')
  create(@Body() data: { name: string; description?: string }) {
    return this.productTypesService.create(data);
  }

  @Put(':id')
  @Roles('ADMIN')
  update(
    @Param('id') id: string,
    @Body() data: { name?: string; description?: string; active?: boolean },
  ) {
    return this.productTypesService.update(id, data);
  }

  @Delete(':id')
  @Roles('ADMIN')
  delete(@Param('id') id: string) {
    return this.productTypesService.delete(id);
  }
}
