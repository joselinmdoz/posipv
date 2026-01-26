import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { CashSessionsService } from "./cash-sessions.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { IsNumberString, IsOptional, IsString } from "class-validator";

class OpenDto {
  @IsString() registerId!: string;
  @IsNumberString() openingAmount!: string;
  @IsOptional() @IsString() note?: string;
}

class CloseDto {
  @IsNumberString() closingAmount!: string;
  @IsOptional() @IsString() note?: string;
}

@Controller("cash-sessions")
@UseGuards(JwtAuthGuard)
export class CashSessionsController {
  constructor(private service: CashSessionsService) {}

  @Get("open")
  getOpen(@Query("registerId") registerId: string) {
    return this.service.getOpenByRegister(registerId);
  }

  @Post("open")
  open(@Req() req: any, @Body() dto: OpenDto) {
    return this.service.open({
      registerId: dto.registerId,
      openingAmount: dto.openingAmount,
      note: dto.note,
      openedById: req.user.userId,
    });
  }

  @Post(":id/close")
  close(@Param("id") id: string, @Body() dto: CloseDto) {
    return this.service.close(id, dto.closingAmount, dto.note);
  }
}
