import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  AccountingAccountType,
  AccountingPostingRuleKey,
  AccountingPeriodStatus,
  CurrencyCode,
  JournalEntryStatus,
  JournalLineSide,
  Role,
} from "@prisma/client";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Permissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AccountingService } from "./accounting.service";

class ListAccountsQueryDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() active?: string;
  @IsOptional() @IsEnum(AccountingAccountType) type?: AccountingAccountType;
  @IsOptional() @IsString() limit?: string;
}

class CreateAccountDto {
  @IsString() @MaxLength(30) code!: string;
  @IsString() @MaxLength(120) name!: string;
  @IsEnum(AccountingAccountType) type!: AccountingAccountType;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsBoolean() allowManualEntries?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() parentId?: string;
}

class UpdateAccountDto {
  @IsOptional() @IsString() @MaxLength(30) code?: string;
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsEnum(AccountingAccountType) type?: AccountingAccountType;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsBoolean() allowManualEntries?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() parentId?: string;
}

class UpdatePostingRuleDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() debitAccountId?: string;
  @IsOptional() @IsString() creditAccountId?: string;
}

class CreatePostingRuleDto extends UpdatePostingRuleDto {
  @IsEnum(AccountingPostingRuleKey) key!: AccountingPostingRuleKey;
}

class ListPeriodsQueryDto {
  @IsOptional() @IsEnum(AccountingPeriodStatus) status?: AccountingPeriodStatus;
  @IsOptional() @IsString() fromDate?: string;
  @IsOptional() @IsString() toDate?: string;
  @IsOptional() @IsString() limit?: string;
}

class CreatePeriodDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsString() startDate!: string;
  @IsString() endDate!: string;
}

class ClosePeriodDto {
  @IsOptional() @IsString() @MaxLength(1000) closeNotes?: string;
}

class ListJournalEntriesQueryDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsEnum(JournalEntryStatus) status?: JournalEntryStatus;
  @IsOptional() @IsString() periodId?: string;
  @IsOptional() @IsString() fromDate?: string;
  @IsOptional() @IsString() toDate?: string;
  @IsOptional() @IsString() limit?: string;
}

class AccountingReportQueryDto {
  @IsOptional() @IsString() periodId?: string;
  @IsOptional() @IsString() fromDate?: string;
  @IsOptional() @IsString() toDate?: string;
  @IsOptional() @IsString() includeDraft?: string;
  @IsOptional() @IsString() includeVoid?: string;
  @IsOptional() @IsString() limit?: string;
}

class CreateJournalEntryLineDto {
  @IsString() accountId!: string;
  @IsEnum(JournalLineSide) side!: JournalLineSide;
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;
  @IsOptional() @IsString() @MaxLength(300) memo?: string;
}

class CreateJournalEntryDto {
  @IsOptional() @IsString() date?: string;
  @IsString() @MaxLength(500) description!: string;
  @IsOptional() @IsString() @MaxLength(120) reference?: string;
  @IsOptional() @IsEnum(CurrencyCode) currency?: CurrencyCode;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.000001) exchangeRateUsdToCup?: number;
  @IsOptional() @IsString() periodId?: string;
  @IsOptional() @IsString() @MaxLength(80) sourceType?: string;
  @IsOptional() @IsString() @MaxLength(120) sourceId?: string;
  @IsOptional() @IsEnum(JournalEntryStatus) status?: JournalEntryStatus;
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => CreateJournalEntryLineDto)
  lines!: CreateJournalEntryLineDto[];
}

class VoidJournalEntryDto {
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

@Controller("accounting")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.CASHIER)
export class AccountingController {
  constructor(private readonly service: AccountingService) {}

  @Get("accounts")
  @UseGuards(PermissionsGuard)
  @Permissions("accounting.view")
  listAccounts(@Query() query: ListAccountsQueryDto) {
    return this.service.listAccounts(query);
  }

  @Post("accounts")
  @UseGuards(PermissionsGuard)
  @Permissions("accounting.manage")
  createAccount(@Body() dto: CreateAccountDto) {
    return this.service.createAccount(dto);
  }

  @Get("accounts/:id")
  @UseGuards(PermissionsGuard)
  @Permissions("accounting.view")
  getAccount(@Param("id") id: string) {
    return this.service.getAccount(id);
  }

  @Put("accounts/:id")
  @UseGuards(PermissionsGuard)
  @Permissions("accounting.manage")
  updateAccount(@Param("id") id: string, @Body() dto: UpdateAccountDto) {
    return this.service.updateAccount(id, dto);
  }

  @Delete("accounts/:id")
  @UseGuards(PermissionsGuard)
  @Permissions("accounting.manage")
  deleteAccount(@Param("id") id: string) {
    return this.service.deleteAccount(id);
  }

  @Post("accounts/bootstrap")
  @UseGuards(PermissionsGuard)
  @Permissions("accounting.manage")
  seedDefaultChart() {
    return this.service.seedDefaultChart();
  }

  @Get("posting-rules")
  @UseGuards(PermissionsGuard)
  @Permissions("accounting.view")
  listPostingRules() {
    return this.service.listPostingRules();
  }

  @Post("posting-rules")
  @UseGuards(PermissionsGuard)
  @Permissions("accounting.manage")
  createPostingRule(@Body() dto: CreatePostingRuleDto) {
    return this.service.createPostingRule(dto);
  }

  @Put("posting-rules/:key")
  @UseGuards(PermissionsGuard)
  @Permissions("accounting.manage")
  updatePostingRule(@Param("key") key: AccountingPostingRuleKey, @Body() dto: UpdatePostingRuleDto) {
    const validKeys = new Set<AccountingPostingRuleKey>([
      "SALE_REVENUE_CUP",
      "SALE_REVENUE_USD",
      "SALE_COGS",
      "STOCK_IN",
      "STOCK_OUT",
    ]);

    if (!validKeys.has(key)) {
      throw new BadRequestException("Clave de regla contable inválida.");
    }

    return this.service.updatePostingRule(key, dto);
  }

  @Delete("posting-rules/:key")
  @UseGuards(PermissionsGuard)
  @Permissions("accounting.manage")
  deletePostingRule(@Param("key") key: AccountingPostingRuleKey) {
    const validKeys = new Set<AccountingPostingRuleKey>([
      "SALE_REVENUE_CUP",
      "SALE_REVENUE_USD",
      "SALE_COGS",
      "STOCK_IN",
      "STOCK_OUT",
    ]);

    if (!validKeys.has(key)) {
      throw new BadRequestException("Clave de regla contable inválida.");
    }

    return this.service.deletePostingRule(key);
  }

  @Post("posting-rules/bootstrap")
  @UseGuards(PermissionsGuard)
  @Permissions("accounting.manage")
  seedDefaultPostingRules() {
    return this.service.seedDefaultPostingRules();
  }

  @Get("periods")
  @UseGuards(PermissionsGuard)
  @Permissions("accounting.view")
  listPeriods(@Query() query: ListPeriodsQueryDto) {
    return this.service.listPeriods(query);
  }

  @Post("periods")
  @UseGuards(PermissionsGuard)
  @Permissions("accounting.periods.manage")
  createPeriod(@Body() dto: CreatePeriodDto) {
    return this.service.createPeriod(dto);
  }

  @Get("periods/:id")
  @UseGuards(PermissionsGuard)
  @Permissions("accounting.view")
  getPeriod(@Param("id") id: string) {
    return this.service.getPeriod(id);
  }

  @Put("periods/:id")
  @UseGuards(PermissionsGuard)
  @Permissions("accounting.periods.manage")
  updatePeriod(@Param("id") id: string, @Body() dto: CreatePeriodDto) {
    return this.service.updatePeriod(id, dto);
  }

  @Put("periods/:id/close")
  @UseGuards(PermissionsGuard)
  @Permissions("accounting.periods.manage")
  closePeriod(@Param("id") id: string, @Body() dto: ClosePeriodDto, @Req() req: Request & { user: { userId: string } }) {
    return this.service.closePeriod(id, req.user.userId, dto.closeNotes);
  }

  @Put("periods/:id/reopen")
  @UseGuards(PermissionsGuard)
  @Permissions("accounting.periods.manage")
  reopenPeriod(@Param("id") id: string) {
    return this.service.reopenPeriod(id);
  }

  @Delete("periods/:id")
  @UseGuards(PermissionsGuard)
  @Permissions("accounting.periods.manage")
  deletePeriod(@Param("id") id: string) {
    return this.service.deletePeriod(id);
  }

  @Get("journal-entries")
  @UseGuards(PermissionsGuard)
  @Permissions("accounting.view")
  listJournalEntries(@Query() query: ListJournalEntriesQueryDto) {
    return this.service.listJournalEntries(query);
  }

  @Get("reports/journal")
  @UseGuards(PermissionsGuard)
  @Permissions("accounting.view")
  getJournalReport(@Query() query: AccountingReportQueryDto) {
    return this.service.getJournalReport(query);
  }

  @Get("reports/ledger/:accountId")
  @UseGuards(PermissionsGuard)
  @Permissions("accounting.view")
  getLedgerReport(@Param("accountId") accountId: string, @Query() query: AccountingReportQueryDto) {
    return this.service.getLedgerReport(accountId, query);
  }

  @Get("reports/trial-balance")
  @UseGuards(PermissionsGuard)
  @Permissions("accounting.view")
  getTrialBalanceReport(@Query() query: AccountingReportQueryDto) {
    return this.service.getTrialBalanceReport(query);
  }

  @Get("journal-entries/:id")
  @UseGuards(PermissionsGuard)
  @Permissions("accounting.view")
  getJournalEntry(@Param("id") id: string) {
    return this.service.getJournalEntry(id);
  }

  @Post("journal-entries")
  @UseGuards(PermissionsGuard)
  @Permissions("accounting.post")
  createJournalEntry(@Body() dto: CreateJournalEntryDto, @Req() req: Request & { user: { userId: string } }) {
    return this.service.createJournalEntry(dto, req.user.userId);
  }

  @Put("journal-entries/:id/post")
  @UseGuards(PermissionsGuard)
  @Permissions("accounting.post")
  postJournalEntry(@Param("id") id: string, @Req() req: Request & { user: { userId: string } }) {
    return this.service.postJournalEntry(id, req.user.userId);
  }

  @Put("journal-entries/:id/void")
  @UseGuards(PermissionsGuard)
  @Permissions("accounting.adjust")
  voidJournalEntry(@Param("id") id: string, @Body() dto: VoidJournalEntryDto) {
    return this.service.voidJournalEntry(id, dto);
  }
}
