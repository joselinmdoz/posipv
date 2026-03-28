import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CustomersService } from "./customers.service";
import { IsBoolean, IsBooleanString, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { Permissions } from "../auth/permissions.decorator";

class CreateCustomerDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsString() @MinLength(3) @MaxLength(40) identification!: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(120) email?: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
}

class UpdateCustomerDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MinLength(3) @MaxLength(40) identification?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(120) email?: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

class ListCustomersQueryDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsBooleanString() active?: string;
  @IsOptional() @IsString() limit?: string;
}

@Controller("customers")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CustomersController {
  constructor(private readonly service: CustomersService) {}

  @Get()
  @Permissions("customers.view", "sales.direct")
  list(@Query() query: ListCustomersQueryDto) {
    return this.service.list({
      q: query.q,
      active: query.active,
      limit: query.limit,
    });
  }

  @Post()
  @Permissions("customers.manage", "sales.direct")
  create(@Body() dto: CreateCustomerDto) {
    return this.service.create(dto);
  }

  @Get(":id")
  @Permissions("customers.view", "sales.direct")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Put(":id")
  @Permissions("customers.manage", "sales.direct")
  update(@Param("id") id: string, @Body() dto: UpdateCustomerDto) {
    return this.service.update(id, dto);
  }

  @Get(":id/history")
  @Permissions("customers.view", "sales.direct")
  getHistory(@Param("id") id: string) {
    return this.service.getHistory(id);
  }
}
