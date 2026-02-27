import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CustomersService } from "./customers.service";
import { IsBooleanString, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

class CreateCustomerDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsString() @MinLength(3) @MaxLength(40) identification!: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(120) email?: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
}

class ListCustomersQueryDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsBooleanString() active?: string;
  @IsOptional() @IsString() limit?: string;
}

@Controller("customers")
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private readonly service: CustomersService) {}

  @Get()
  list(@Query() query: ListCustomersQueryDto) {
    return this.service.list({
      q: query.q,
      active: query.active,
      limit: query.limit,
    });
  }

  @Post()
  create(@Body() dto: CreateCustomerDto) {
    return this.service.create(dto);
  }

  @Get(":id/history")
  getHistory(@Param("id") id: string) {
    return this.service.getHistory(id);
  }
}
