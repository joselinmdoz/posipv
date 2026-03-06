import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { IsBoolean, IsBooleanString, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { Role } from "@prisma/client";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { EmployeesService } from "./employees.service";

class ListEmployeesQueryDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsBooleanString() active?: string;
  @IsOptional() @IsString() limit?: string;
}

class CreateEmployeeDto {
  @IsString() @MinLength(2) @MaxLength(80) firstName!: string;
  @IsString() @MinLength(2) @MaxLength(120) lastName!: string;
  @IsOptional() @IsString() @MaxLength(40) identification?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(120) email?: string;
  @IsOptional() @IsString() @MaxLength(80) position?: string;
  @IsOptional() @IsString() hireDate?: string;
  @IsOptional() @IsString() salary?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() userId?: string;
}

class UpdateEmployeeDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) firstName?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) lastName?: string;
  @IsOptional() @IsString() @MaxLength(40) identification?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(120) email?: string;
  @IsOptional() @IsString() @MaxLength(80) position?: string;
  @IsOptional() @IsString() hireDate?: string;
  @IsOptional() @IsString() salary?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() userId?: string;
}

@Controller("employees")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class EmployeesController {
  constructor(private readonly service: EmployeesService) {}

  @Get()
  list(@Query() query: ListEmployeesQueryDto) {
    return this.service.list(query);
  }

  @Get("users/available")
  listAssignableUsers(@Query("excludeEmployeeId") excludeEmployeeId?: string) {
    return this.service.listAssignableUsers(excludeEmployeeId);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateEmployeeDto) {
    return this.service.create(dto);
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() dto: UpdateEmployeeDto) {
    return this.service.update(id, dto);
  }
}
