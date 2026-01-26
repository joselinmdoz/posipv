import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { RegistersService } from "./registers.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { Role } from "@prisma/client";
import { IsString, MinLength, IsOptional } from "class-validator";

class CreateRegisterDto {
  @IsString() @MinLength(2) name!: string;
  @IsOptional() @IsString() code?: string;
}

@Controller("registers")
@UseGuards(JwtAuthGuard, RolesGuard)
export class RegistersController {
  constructor(private service: RegistersService) {}

  @Get()
  list() {
    return this.service.listActive();
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateRegisterDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: CreateRegisterDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
