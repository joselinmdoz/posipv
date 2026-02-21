import { Body, Controller, Delete, Get, Param, Post, Put, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ProductsService } from "./products.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { IsNumberString, IsOptional, IsString, MinLength } from "class-validator";
import { diskStorage } from "multer";
import { extname } from "path";

class CreateProductDto {
  @IsString() @MinLength(2) name!: string;
  @IsOptional() @IsString() sku?: string;
  @IsOptional() @IsString() barcode?: string;
  @IsNumberString() price!: string;
  @IsOptional() @IsNumberString() cost?: string;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsString() image?: string;
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
  create(@Body() dto: CreateProductDto, @UploadedFile() file?: Express.Multer.File) {
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
  update(@Param('id') id: string, @Body() dto: Partial<CreateProductDto & { active?: boolean; existingImage?: string }>, @UploadedFile() file?: Express.Multer.File) {
    if (file) {
      dto.image = `/uploads/${file.filename}`;
    } else if (dto.existingImage) {
      // Mantener la imagen existente si no se subió una nueva
      dto.image = dto.existingImage;
      delete dto.existingImage;
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
