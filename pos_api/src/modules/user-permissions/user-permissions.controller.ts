import { Body, Controller, Get, Param, Put, Query, UseGuards } from "@nestjs/common";
import { ArrayMaxSize, IsArray, IsBooleanString, IsOptional, IsString } from "class-validator";
import { Role } from "@prisma/client";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { UserPermissionsService } from "./user-permissions.service";

class ListUsersQueryDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsBooleanString() active?: string;
  @IsOptional() @IsString() limit?: string;
}

class UpdateUserPermissionsDto {
  @IsArray() @ArrayMaxSize(200) @IsString({ each: true }) permissions!: string[];
}

@Controller("user-permissions")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class UserPermissionsController {
  constructor(private readonly service: UserPermissionsService) {}

  @Get("catalog")
  getCatalog() {
    return this.service.getCatalog();
  }

  @Get("users")
  listUsers(@Query() query: ListUsersQueryDto) {
    return this.service.listUsers(query);
  }

  @Get("users/:id")
  getUser(@Param("id") id: string) {
    return this.service.getUser(id);
  }

  @Put("users/:id")
  updateUserPermissions(@Param("id") id: string, @Body() dto: UpdateUserPermissionsDto) {
    return this.service.updateUserPermissions(id, dto.permissions || []);
  }
}
