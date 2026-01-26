import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { SalesService } from "./sales.service";
import { IsArray, IsEnum, IsInt, IsString, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { PaymentMethod } from "@prisma/client";

class ItemDto {
  @IsString() productId!: string;
  @IsInt() @Min(1) qty!: number;
}

class PayDto {
  @IsEnum(PaymentMethod) method!: PaymentMethod;
  @IsString() amount!: string; // decimal string
}

class CreateSaleDto {
  @IsString() cashSessionId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  items!: ItemDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PayDto)
  payments!: PayDto[];
}

@Controller("sales")
@UseGuards(JwtAuthGuard)
export class SalesController {
  constructor(private service: SalesService) {}

  @Post()
  create(@Req() req: any, @Body() dto: CreateSaleDto) {
    return this.service.createSale(req.user.userId, dto);
  }
}
