import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { CashSessionsService } from "./cash-sessions.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { IsIn, IsNumber, IsNumberString, IsOptional, IsString } from "class-validator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { Permissions } from "../auth/permissions.decorator";

class OpenDto {
  @IsString() registerId!: string;
  @IsNumberString() openingAmount!: string;
  @IsOptional() @IsString() note?: string;
}

class CloseDto {
  @IsNumberString() closingAmount!: string;
  @IsOptional() @IsString() note?: string;
}

class SessionMovementDto {
  @IsString() productId!: string;
  @IsIn(["IN", "OUT"]) type!: "IN" | "OUT";
  @IsNumber() qty!: number;
  @IsOptional() @IsString() reason?: string;
}

@Controller("cash-sessions")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CashSessionsController {
  constructor(private service: CashSessionsService) {}

  @Get()
  @Permissions("sales.tpv", "tpv.manage", "reports.view")
  list() {
    return this.service.findAll();
  }

  @Get("open")
  @Permissions("sales.tpv", "tpv.manage", "reports.view")
  getOpen(@Query("registerId") registerId: string) {
    return this.service.getOpenByRegister(registerId);
  }

  @Get(":id/summary")
  @Permissions("sales.tpv", "tpv.manage", "reports.view")
  getSummary(@Param("id") id: string) {
    return this.service.getSessionSummary(id);
  }

  @Get(":id")
  @Permissions("sales.tpv", "tpv.manage", "reports.view")
  getOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post("open")
  @Permissions("sales.tpv", "tpv.manage")
  open(@Req() req: any, @Body() dto: OpenDto) {
    return this.service.open({
      registerId: dto.registerId,
      openingAmount: dto.openingAmount,
      note: dto.note,
      openedById: req.user.userId,
    });
  }

  @Post(":id/close")
  @Permissions("sales.tpv", "tpv.manage")
  close(@Param("id") id: string, @Body() dto: CloseDto) {
    return this.service.close(id, dto.closingAmount, dto.note);
  }

  @Post(":id/movement")
  @Permissions("sales.tpv", "tpv.manage")
  createSessionMovement(@Req() req: any, @Param("id") id: string, @Body() dto: SessionMovementDto) {
    return this.service.createSessionMovement({
      cashSessionId: id,
      type: dto.type,
      productId: dto.productId,
      qty: dto.qty,
      reason: dto.reason,
      userId: req.user.userId,
    });
  }
}
