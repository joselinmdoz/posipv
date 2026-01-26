import { Body, Controller, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from "class-validator";

class CreateUserDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(6) password!: string;
  @IsEnum(['ADMIN', 'CASHIER']) role!: 'ADMIN' | 'CASHIER';
}

class UpdateUserDto {
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsEnum(['ADMIN', 'CASHIER']) role?: 'ADMIN' | 'CASHIER';
  @IsOptional() active?: boolean;
}

class ResetPasswordDto {
  @IsString() @MinLength(6) password!: string;
}

@Controller("users")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class UsersController {
  constructor(private service: UsersService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.service.create(dto);
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() dto: UpdateUserDto) {
    return this.service.update(id, dto);
  }

  @Post(":id/reset-password")
  resetPassword(@Param("id") id: string, @Body() dto: ResetPasswordDto) {
    return this.service.resetPassword(id, dto);
  }
}