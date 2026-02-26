import { Body, Controller, Delete, Get, Param, Post, Put, UploadedFile, UseGuards, UseInterceptors, Req } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ProductsService } from "./products.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { IsEnum, IsNumberString, IsOptional, IsString, MinLength } from "class-validator";
import { diskStorage } from "multer";
import { extname } from "path";
import { CurrencyCode } from "@prisma/client";

class CreateProductDto {
  @IsString() @MinLength(2) name!: string;
  @IsOptional() @IsString() codigo?: string;
  @IsOptional() @IsString() barcode?: string;
  @IsNumberString() price!: string;
  @IsOptional() @IsNumberString() cost?: string;
  @IsOptional() @IsEnum(CurrencyCode) currency?: CurrencyCode;
  @IsOptional() @IsString() image?: string;
  @IsOptional() @IsString() productTypeId?: string;
  @IsOptional() @IsString() productCategoryId?: string;
  @IsOptional() @IsString() measurementUnitId?: string;
}

@Controller("products")
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private service: ProductsService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  @UseInterceptors(FileInterceptor('image', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, callback) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        callback(null, file.fieldname + '-' + uniqueSuffix + extname(file.originalname));
      },
    }),
  }))
  create(@Req() req: any, @UploadedFile() file?: Express.Multer.File) {
    const dto: CreateProductDto = {
      name: req.body.name,
      price: req.body.price,
      codigo: req.body.codigo,
      barcode: req.body.barcode,
      cost: req.body.cost,
      currency: req.body.currency,
      productTypeId: req.body.productTypeId,
      productCategoryId: req.body.productCategoryId,
      measurementUnitId: req.body.measurementUnitId,
    };
    if (file) {
      dto.image = `/uploads/${file.filename}`;
    }
    return this.service.create(dto);
  }

  @Put(':id')
  @UseInterceptors(FileInterceptor('image', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, callback) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        callback(null, file.fieldname + '-' + uniqueSuffix + extname(file.originalname));
      },
    }),
  }))
  update(@Param('id') id: string, @Req() req: any, @UploadedFile() file?: Express.Multer.File) {
    const dto: Partial<CreateProductDto & { active?: boolean; existingImage?: string }> = {
      name: req.body.name,
      price: req.body.price,
      codigo: req.body.codigo,
      barcode: req.body.barcode,
      cost: req.body.cost,
      currency: req.body.currency,
      productTypeId: req.body.productTypeId,
      productCategoryId: req.body.productCategoryId,
      measurementUnitId: req.body.measurementUnitId,
    };
    
    if (req.body.active !== undefined) {
      dto.active = req.body.active === 'true';
    }
    
    if (file) {
      dto.image = `/uploads/${file.filename}`;
    } else if (req.body.existingImage) {
      dto.image = req.body.existingImage;
    }
    return this.service.update(id, dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
