import { Controller, Delete, Get, Param, Post, Put, Query, UploadedFile, UseGuards, UseInterceptors, Req } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ProductsService } from "./products.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { IsEnum, IsNumberString, IsOptional, IsString, MinLength } from "class-validator";
import { diskStorage } from "multer";
import { extname } from "path";
import { CurrencyCode } from "@prisma/client";
import { PermissionsGuard } from "../auth/permissions.guard";
import { Permissions } from "../auth/permissions.decorator";

class CreateProductDto {
  @IsString() @MinLength(2) name!: string;
  @IsOptional() @IsString() codigo?: string;
  @IsOptional() @IsString() barcode?: string;
  @IsNumberString() price!: string;
  @IsOptional() @IsNumberString() cost?: string;
  @IsOptional() @IsNumberString() lowStockAlertQty?: string;
  @IsOptional() allowFractionalQty?: boolean;
  @IsOptional() @IsEnum(CurrencyCode) currency?: CurrencyCode;
  @IsOptional() @IsString() image?: string;
  @IsOptional() @IsString() productTypeId?: string;
  @IsOptional() @IsString() productCategoryId?: string;
  @IsOptional() @IsString() measurementUnitId?: string;
}

const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

const productImageUploadOptions = {
  storage: diskStorage({
    destination: "./uploads",
    filename: (req: any, file: Express.Multer.File, callback: (error: Error | null, filename: string) => void) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      callback(null, `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`);
    },
  }),
  limits: {
    fileSize: PRODUCT_IMAGE_MAX_BYTES,
  },
};

@Controller("products")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProductsController {
  constructor(private service: ProductsService) {}

  @Get()
  @Permissions("products.view", "products.manage", "purchases.view", "purchases.manage", "warehouses.view", "sales.tpv")
  list(@Query("includeInactive") includeInactive?: string) {
    const includeAll = ["1", "true", "yes"].includes(String(includeInactive || "").toLowerCase());
    return this.service.list(includeAll);
  }

  @Post()
  @Permissions("products.manage")
  @UseInterceptors(FileInterceptor("image", productImageUploadOptions))
  create(@Req() req: any, @UploadedFile() file?: Express.Multer.File) {
    const dto: CreateProductDto = {
      name: req.body.name,
      price: req.body.price,
      codigo: req.body.codigo,
      barcode: req.body.barcode,
      cost: req.body.cost,
      lowStockAlertQty: req.body.lowStockAlertQty,
      currency: req.body.currency,
      productTypeId: req.body.productTypeId,
      productCategoryId: req.body.productCategoryId,
      measurementUnitId: req.body.measurementUnitId,
    };
    if (req.body.allowFractionalQty !== undefined) {
      dto.allowFractionalQty = req.body.allowFractionalQty === 'true' || req.body.allowFractionalQty === true;
    }
    if (file) {
      dto.image = `/uploads/${file.filename}`;
    }
    return this.service.create(dto);
  }

  @Put(':id')
  @Permissions("products.manage")
  @UseInterceptors(FileInterceptor("image", productImageUploadOptions))
  update(@Param('id') id: string, @Req() req: any, @UploadedFile() file?: Express.Multer.File) {
    const dto: Partial<CreateProductDto & { active?: boolean; existingImage?: string }> = {
      name: req.body.name,
      price: req.body.price,
      codigo: req.body.codigo,
      barcode: req.body.barcode,
      cost: req.body.cost,
      lowStockAlertQty: req.body.lowStockAlertQty,
      currency: req.body.currency,
      productTypeId: req.body.productTypeId,
      productCategoryId: req.body.productCategoryId,
      measurementUnitId: req.body.measurementUnitId,
    };
    
    if (req.body.active !== undefined) {
      dto.active = req.body.active === 'true';
    }
    if (req.body.allowFractionalQty !== undefined) {
      dto.allowFractionalQty = req.body.allowFractionalQty === 'true' || req.body.allowFractionalQty === true;
    }
    
    if (file) {
      dto.image = `/uploads/${file.filename}`;
    } else if (req.body.existingImage) {
      dto.image = req.body.existingImage;
    }
    return this.service.update(id, dto);
  }

  @Get(':id')
  @Permissions("products.view", "products.manage", "purchases.view", "purchases.manage", "warehouses.view")
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Delete(':id')
  @Permissions("products.manage")
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
