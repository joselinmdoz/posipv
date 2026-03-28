import { Controller, Get, Param, Post, Put, Query, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { IsBoolean, IsBooleanString, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { Role } from "@prisma/client";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { EmployeesService } from "./employees.service";
import { diskStorage } from "multer";
import { extname } from "path";

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
  @IsOptional() @IsString() @MaxLength(255) image?: string;
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
  @IsOptional() @IsString() @MaxLength(255) image?: string;
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
  @UseInterceptors(FileInterceptor("image", {
    storage: diskStorage({
      destination: "./uploads",
      filename: (req, file, callback) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        callback(null, `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`);
      },
    }),
  }))
  create(@Req() req: any, @UploadedFile() file?: Express.Multer.File) {
    const dto: CreateEmployeeDto = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      identification: req.body.identification,
      phone: req.body.phone,
      email: req.body.email,
      position: req.body.position,
      hireDate: req.body.hireDate,
      salary: req.body.salary,
      notes: req.body.notes,
      userId: req.body.userId,
    };
    if (req.body.active !== undefined) {
      dto.active = req.body.active === "true" || req.body.active === true;
    }
    if (file) {
      dto.image = `/uploads/${file.filename}`;
    }
    return this.service.create(dto);
  }

  @Put(":id")
  @UseInterceptors(FileInterceptor("image", {
    storage: diskStorage({
      destination: "./uploads",
      filename: (req, file, callback) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        callback(null, `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`);
      },
    }),
  }))
  update(@Param("id") id: string, @Req() req: any, @UploadedFile() file?: Express.Multer.File) {
    const dto: UpdateEmployeeDto = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      identification: req.body.identification,
      phone: req.body.phone,
      email: req.body.email,
      position: req.body.position,
      hireDate: req.body.hireDate,
      salary: req.body.salary,
      notes: req.body.notes,
      userId: req.body.userId,
    };
    if (req.body.active !== undefined) {
      dto.active = req.body.active === "true" || req.body.active === true;
    }
    if (file) {
      dto.image = `/uploads/${file.filename}`;
    } else if (req.body.existingImage !== undefined) {
      dto.image = req.body.existingImage;
    }
    return this.service.update(id, dto);
  }
}
