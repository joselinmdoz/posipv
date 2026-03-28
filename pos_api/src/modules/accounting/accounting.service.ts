import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AccountingAccountType,
  AccountingPostingRuleKey,
  AccountingPeriodStatus,
  CurrencyCode,
  JournalEntryStatus,
  JournalLineSide,
  Prisma,
} from "@prisma/client";
import { dec } from "../../common/decimal";
import { PrismaService } from "../../prisma/prisma.service";

type ListAccountsInput = {
  q?: string;
  active?: string;
  type?: AccountingAccountType;
  limit?: string;
};

type CreateAccountInput = {
  code: string;
  name: string;
  type: AccountingAccountType;
  description?: string;
  allowManualEntries?: boolean;
  active?: boolean;
  parentId?: string | null;
};

type UpdateAccountInput = Partial<CreateAccountInput>;

type ListPeriodsInput = {
  status?: AccountingPeriodStatus;
  fromDate?: string;
  toDate?: string;
  limit?: string;
};

type CreatePeriodInput = {
  name?: string;
  startDate: string;
  endDate: string;
};

type ListEntriesInput = {
  q?: string;
  status?: JournalEntryStatus;
  periodId?: string;
  fromDate?: string;
  toDate?: string;
  limit?: string;
};

type AccountingReportFiltersInput = {
  periodId?: string;
  fromDate?: string;
  toDate?: string;
  includeDraft?: string;
  includeVoid?: string;
  limit?: string;
};

type JournalLineInput = {
  accountId: string;
  side: JournalLineSide;
  amount: number;
  memo?: string;
};

type CreateJournalEntryInput = {
  date?: string;
  description: string;
  reference?: string;
  currency?: CurrencyCode;
  exchangeRateUsdToCup?: number;
  periodId?: string;
  sourceType?: string;
  sourceId?: string;
  status?: JournalEntryStatus;
  lines: JournalLineInput[];
};

type VoidEntryInput = {
  reason?: string;
};

type DefaultAccountSeed = {
  code: string;
  name: string;
  type: AccountingAccountType;
  description?: string;
};

type UpdatePostingRuleInput = {
  key?: AccountingPostingRuleKey;
  name?: string;
  description?: string;
  active?: boolean;
  debitAccountId?: string;
  creditAccountId?: string;
};

const DEFAULT_CHART_OF_ACCOUNTS: DefaultAccountSeed[] = [
  { code: "1101", name: "Caja CUP", type: "ASSET", description: "Efectivo en moneda CUP" },
  { code: "1102", name: "Caja USD", type: "ASSET", description: "Efectivo en moneda USD" },
  { code: "1201", name: "Cuentas por cobrar", type: "ASSET", description: "Saldos pendientes de cobro" },
  { code: "1301", name: "Inventario", type: "ASSET", description: "Inventario de mercancías" },
  { code: "2101", name: "Cuentas por pagar", type: "LIABILITY", description: "Obligaciones con terceros" },
  { code: "3101", name: "Capital", type: "EQUITY", description: "Capital y aportes" },
  { code: "4101", name: "Ingresos por ventas", type: "INCOME", description: "Ventas de productos y servicios" },
  { code: "5101", name: "Costo de ventas", type: "EXPENSE", description: "Costo directo del inventario vendido" },
  { code: "5201", name: "Gastos operativos", type: "EXPENSE", description: "Gastos de operación" },
];

const DEFAULT_POSTING_RULES: Array<{
  key: AccountingPostingRuleKey;
  name: string;
  description: string;
  debitAccountCode: string;
  creditAccountCode: string;
}> = [
  {
    key: "SALE_REVENUE_CUP",
    name: "Venta ingreso CUP",
    description: "Registro automático de ingreso por venta cobrada en CUP.",
    debitAccountCode: "1101",
    creditAccountCode: "4101",
  },
  {
    key: "SALE_REVENUE_USD",
    name: "Venta ingreso USD",
    description: "Registro automático de ingreso por venta cobrada en USD.",
    debitAccountCode: "1102",
    creditAccountCode: "4101",
  },
  {
    key: "SALE_COGS",
    name: "Costo de venta",
    description: "Registro automático de costo de ventas contra inventario.",
    debitAccountCode: "5101",
    creditAccountCode: "1301",
  },
  {
    key: "STOCK_IN",
    name: "Entrada de inventario",
    description: "Entrada manual de inventario contra cuenta de ajuste/pasivo.",
    debitAccountCode: "1301",
    creditAccountCode: "2101",
  },
  {
    key: "STOCK_OUT",
    name: "Salida de inventario",
    description: "Salida manual de inventario contra gasto.",
    debitAccountCode: "5201",
    creditAccountCode: "1301",
  },
];

@Injectable()
export class AccountingService {
  constructor(private readonly prisma: PrismaService) {}

  async listAccounts(input: ListAccountsInput) {
    const q = this.normalize(input.q);
    const active = this.parseOptionalBoolean(input.active);
    const limit = this.parseLimit(input.limit, 500);

    return this.prisma.accountingAccount.findMany({
      where: {
        ...(active === null ? {} : { active }),
        ...(input.type ? { type: input.type } : {}),
        ...(q
          ? {
              OR: [
                { code: { contains: q, mode: "insensitive" } },
                { name: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ code: "asc" }],
      take: limit,
    });
  }

  async createAccount(input: CreateAccountInput) {
    const code = this.normalizeAccountCode(input.code);
    const name = this.requiredText(input.name, "name", 120);
    const parentId = input.parentId?.trim() || null;

    if (parentId) {
      await this.ensureAccountExists(parentId);
    }

    return this.prisma.accountingAccount.create({
      data: {
        code,
        name,
        type: input.type,
        description: this.optionalText(input.description, 500),
        allowManualEntries: input.allowManualEntries !== false,
        active: input.active !== false,
        parentId,
      },
    });
  }

  async getAccount(accountId: string) {
    return this.ensureAccountExists(accountId);
  }

  async updateAccount(accountId: string, input: UpdateAccountInput) {
    await this.ensureAccountExists(accountId);

    if (input.parentId && input.parentId === accountId) {
      throw new BadRequestException("La cuenta no puede ser su propio padre.");
    }

    if (input.parentId) {
      await this.ensureAccountExists(input.parentId);
    }

    return this.prisma.accountingAccount.update({
      where: { id: accountId },
      data: {
        ...(input.code !== undefined ? { code: this.normalizeAccountCode(input.code) } : {}),
        ...(input.name !== undefined ? { name: this.requiredText(input.name, "name", 120) } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.description !== undefined ? { description: this.optionalText(input.description, 500) } : {}),
        ...(input.allowManualEntries !== undefined ? { allowManualEntries: !!input.allowManualEntries } : {}),
        ...(input.active !== undefined ? { active: !!input.active } : {}),
        ...(input.parentId !== undefined ? { parentId: input.parentId?.trim() || null } : {}),
      },
    });
  }

  async deleteAccount(accountId: string) {
    await this.ensureAccountExists(accountId);

    const [hasChildren, linesCount, debitRulesCount, creditRulesCount] = await Promise.all([
      this.prisma.accountingAccount.count({ where: { parentId: accountId } }),
      this.prisma.journalLine.count({ where: { accountId } }),
      this.prisma.accountingPostingRule.count({ where: { debitAccountId: accountId } }),
      this.prisma.accountingPostingRule.count({ where: { creditAccountId: accountId } }),
    ]);

    if (hasChildren > 0) {
      throw new BadRequestException("No se puede eliminar una cuenta con subcuentas.");
    }
    if (linesCount > 0) {
      throw new BadRequestException("No se puede eliminar una cuenta con movimientos contables.");
    }
    if (debitRulesCount > 0 || creditRulesCount > 0) {
      throw new BadRequestException("No se puede eliminar una cuenta asociada a reglas contables.");
    }

    return this.prisma.accountingAccount.delete({
      where: { id: accountId },
      select: { id: true, code: true, name: true },
    });
  }

  async listPostingRules() {
    await this.prisma.$transaction(async (tx) => {
      await this.ensureCoreAutomationAccounts(tx);
      await this.ensureDefaultPostingRules(tx);
    });

    return this.prisma.accountingPostingRule.findMany({
      orderBy: [{ key: "asc" }],
      include: {
        debitAccount: {
          select: { id: true, code: true, name: true, active: true },
        },
        creditAccount: {
          select: { id: true, code: true, name: true, active: true },
        },
      },
    });
  }

  async createPostingRule(input: UpdatePostingRuleInput & { key: AccountingPostingRuleKey }) {
    await this.prisma.$transaction(async (tx) => {
      await this.ensureCoreAutomationAccounts(tx);
      await this.ensureDefaultPostingRules(tx);
    });

    const key = input.key;
    const defaultRule = DEFAULT_POSTING_RULES.find((item) => item.key === key);
    if (!defaultRule) {
      throw new BadRequestException("Clave de regla contable inválida.");
    }

    let debitAccountId = input.debitAccountId;
    let creditAccountId = input.creditAccountId;

    if (!debitAccountId || !creditAccountId) {
      const [debitByCode, creditByCode] = await Promise.all([
        this.prisma.accountingAccount.findUnique({
          where: { code: defaultRule.debitAccountCode },
          select: { id: true },
        }),
        this.prisma.accountingAccount.findUnique({
          where: { code: defaultRule.creditAccountCode },
          select: { id: true },
        }),
      ]);
      debitAccountId = debitAccountId || debitByCode?.id;
      creditAccountId = creditAccountId || creditByCode?.id;
    }

    if (!debitAccountId || !creditAccountId) {
      throw new BadRequestException("No se pudieron resolver las cuentas por defecto de la regla.");
    }

    await this.ensureAccountExists(debitAccountId);
    await this.ensureAccountExists(creditAccountId);

    return this.prisma.accountingPostingRule.upsert({
      where: { key },
      update: {
        name: input.name !== undefined ? this.requiredText(input.name, "name", 120) : defaultRule.name,
        description:
          input.description !== undefined
            ? this.optionalText(input.description, 500)
            : defaultRule.description,
        active: input.active !== undefined ? !!input.active : true,
        debitAccountId,
        creditAccountId,
      },
      create: {
        key,
        name: input.name !== undefined ? this.requiredText(input.name, "name", 120) : defaultRule.name,
        description:
          input.description !== undefined
            ? this.optionalText(input.description, 500)
            : defaultRule.description,
        active: input.active !== undefined ? !!input.active : true,
        debitAccountId,
        creditAccountId,
      },
      include: {
        debitAccount: {
          select: { id: true, code: true, name: true, active: true },
        },
        creditAccount: {
          select: { id: true, code: true, name: true, active: true },
        },
      },
    });
  }

  async updatePostingRule(key: AccountingPostingRuleKey, input: UpdatePostingRuleInput) {
    await this.prisma.$transaction(async (tx) => {
      await this.ensureCoreAutomationAccounts(tx);
      await this.ensureDefaultPostingRules(tx);
    });

    const current = await this.prisma.accountingPostingRule.findUnique({
      where: { key },
      select: {
        id: true,
        debitAccountId: true,
        creditAccountId: true,
      },
    });
    if (!current) {
      throw new NotFoundException("Regla contable no encontrada.");
    }

    const debitAccountId = input.debitAccountId || current.debitAccountId;
    const creditAccountId = input.creditAccountId || current.creditAccountId;

    await this.ensureAccountExists(debitAccountId);
    await this.ensureAccountExists(creditAccountId);

    return this.prisma.accountingPostingRule.update({
      where: { key },
      data: {
        ...(input.name !== undefined ? { name: this.requiredText(input.name, "name", 120) } : {}),
        ...(input.description !== undefined ? { description: this.optionalText(input.description, 500) } : {}),
        ...(input.active !== undefined ? { active: !!input.active } : {}),
        ...(input.debitAccountId !== undefined ? { debitAccountId } : {}),
        ...(input.creditAccountId !== undefined ? { creditAccountId } : {}),
      },
      include: {
        debitAccount: {
          select: { id: true, code: true, name: true, active: true },
        },
        creditAccount: {
          select: { id: true, code: true, name: true, active: true },
        },
      },
    });
  }

  async deletePostingRule(key: AccountingPostingRuleKey) {
    const existing = await this.prisma.accountingPostingRule.findUnique({
      where: { key },
      select: { id: true, key: true, name: true, active: true },
    });
    if (!existing) {
      throw new NotFoundException("Regla contable no encontrada.");
    }

    await this.prisma.accountingPostingRule.update({
      where: { key },
      data: { active: false },
    });

    return { id: existing.id, key: existing.key, name: existing.name, active: false };
  }

  async seedDefaultPostingRules() {
    await this.prisma.$transaction(async (tx) => {
      await this.ensureCoreAutomationAccounts(tx);
      await this.ensureDefaultPostingRules(tx);
    });

    return this.listPostingRules();
  }

  async seedDefaultChart() {
    await this.prisma.$transaction(async (tx) => {
      for (const item of DEFAULT_CHART_OF_ACCOUNTS) {
        await tx.accountingAccount.upsert({
          where: { code: item.code },
          update: {
            name: item.name,
            type: item.type,
            description: item.description || null,
            active: true,
            allowManualEntries: true,
          },
          create: {
            code: item.code,
            name: item.name,
            type: item.type,
            description: item.description || null,
            active: true,
            allowManualEntries: true,
          },
        });
      }

      await this.ensureDefaultPostingRules(tx);
    });

    return this.listAccounts({ limit: "1000" });
  }

  async listPeriods(input: ListPeriodsInput) {
    const fromDate = this.parseOptionalDate(input.fromDate, "fromDate");
    const toDate = this.parseOptionalDate(input.toDate, "toDate");
    const limit = this.parseLimit(input.limit, 200);

    return this.prisma.fiscalPeriod.findMany({
      where: {
        ...(input.status ? { status: input.status } : {}),
        ...(fromDate ? { endDate: { gte: fromDate } } : {}),
        ...(toDate ? { startDate: { lte: toDate } } : {}),
      },
      orderBy: [{ startDate: "desc" }],
      take: limit,
    });
  }

  async createPeriod(input: CreatePeriodInput) {
    const startDate = this.parseRequiredDate(input.startDate, "startDate");
    const endDate = this.parseRequiredDate(input.endDate, "endDate");

    if (startDate > endDate) {
      throw new BadRequestException("startDate no puede ser mayor que endDate.");
    }

    const overlap = await this.prisma.fiscalPeriod.findFirst({
      where: {
        NOT: [{ endDate: { lt: startDate } }, { startDate: { gt: endDate } }],
      },
      select: { id: true, name: true, startDate: true, endDate: true },
    });

    if (overlap) {
      throw new BadRequestException(
        `El período se solapa con ${overlap.name} (${overlap.startDate.toISOString()} - ${overlap.endDate.toISOString()}).`,
      );
    }

    const name = this.normalize(input.name) || this.buildPeriodName(startDate, endDate);

    return this.prisma.fiscalPeriod.create({
      data: {
        name,
        startDate,
        endDate,
        status: "OPEN",
      },
    });
  }

  async getPeriod(periodId: string) {
    return this.ensurePeriodExists(periodId);
  }

  async updatePeriod(periodId: string, input: CreatePeriodInput) {
    const period = await this.ensurePeriodExists(periodId);

    const startDate = this.parseRequiredDate(input.startDate, "startDate");
    const endDate = this.parseRequiredDate(input.endDate, "endDate");
    if (startDate > endDate) {
      throw new BadRequestException("startDate no puede ser mayor que endDate.");
    }

    const overlap = await this.prisma.fiscalPeriod.findFirst({
      where: {
        id: { not: periodId },
        NOT: [{ endDate: { lt: startDate } }, { startDate: { gt: endDate } }],
      },
      select: { id: true, name: true, startDate: true, endDate: true },
    });

    if (overlap) {
      throw new BadRequestException(
        `El período se solapa con ${overlap.name} (${overlap.startDate.toISOString()} - ${overlap.endDate.toISOString()}).`,
      );
    }

    const name = this.normalize(input.name) || this.buildPeriodName(startDate, endDate);
    return this.prisma.fiscalPeriod.update({
      where: { id: periodId },
      data: {
        name,
        startDate,
        endDate,
        ...(period.status === "CLOSED" ? { closedAt: period.closedAt || new Date() } : {}),
      },
    });
  }

  async closePeriod(periodId: string, userId: string, closeNotes?: string) {
    const period = await this.ensurePeriodExists(periodId);

    if (period.status === "CLOSED") {
      return period;
    }

    const hasDraftEntries = await this.prisma.journalEntry.count({
      where: {
        periodId,
        status: "DRAFT",
      },
    });

    if (hasDraftEntries > 0) {
      throw new BadRequestException("No se puede cerrar un período con asientos en borrador.");
    }

    return this.prisma.fiscalPeriod.update({
      where: { id: periodId },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        closedById: userId,
        closeNotes: this.optionalText(closeNotes, 1000),
      },
    });
  }

  async reopenPeriod(periodId: string) {
    await this.ensurePeriodExists(periodId);

    return this.prisma.fiscalPeriod.update({
      where: { id: periodId },
      data: {
        status: "OPEN",
        closedAt: null,
        closedById: null,
        closeNotes: null,
      },
    });
  }

  async deletePeriod(periodId: string) {
    await this.ensurePeriodExists(periodId);

    const entriesCount = await this.prisma.journalEntry.count({
      where: { periodId },
    });
    if (entriesCount > 0) {
      throw new BadRequestException("No se puede eliminar un período con asientos registrados.");
    }

    return this.prisma.fiscalPeriod.delete({
      where: { id: periodId },
      select: { id: true, name: true },
    });
  }

  async listJournalEntries(input: ListEntriesInput) {
    const q = this.normalize(input.q);
    const fromDate = this.parseOptionalDate(input.fromDate, "fromDate");
    const toDate = this.parseOptionalDate(input.toDate, "toDate");
    const limit = this.parseLimit(input.limit, 200);

    return this.prisma.journalEntry.findMany({
      where: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.periodId ? { periodId: input.periodId } : {}),
        ...(fromDate || toDate
          ? {
              date: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
            }
          : {}),
        ...(q
          ? {
              OR: [
                { entryNumber: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
                { reference: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: limit,
      include: {
        period: { select: { id: true, name: true, status: true } },
        createdBy: { select: { id: true, email: true } },
        postedBy: { select: { id: true, email: true } },
      },
    });
  }

  async getJournalReport(input: AccountingReportFiltersInput) {
    const where = this.buildReportWhere(input);
    const limit = this.parseLimit(input.limit, 500);

    const entries = await this.prisma.journalEntry.findMany({
      where,
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      take: limit,
      include: {
        period: { select: { id: true, name: true, status: true } },
        createdBy: { select: { id: true, email: true } },
        postedBy: { select: { id: true, email: true } },
        lines: {
          orderBy: [{ createdAt: "asc" }],
          include: {
            account: { select: { id: true, code: true, name: true, type: true } },
          },
        },
      },
    });

    const totals = entries.reduce(
      (acc, entry) => {
        acc.totalDebit = Number(dec(acc.totalDebit).add(entry.totalDebit).toFixed(2));
        acc.totalCredit = Number(dec(acc.totalCredit).add(entry.totalCredit).toFixed(2));
        return acc;
      },
      { totalDebit: 0, totalCredit: 0, entries: entries.length },
    );

    return {
      filters: this.reportFiltersSummary(input),
      totals,
      entries,
    };
  }

  async getLedgerReport(accountId: string, input: AccountingReportFiltersInput) {
    const account = await this.ensureAccountExists(accountId);
    const where = this.buildReportWhere(input);
    const fromDate = this.parseOptionalDate(input.fromDate, "fromDate");
    const limit = this.parseLimit(input.limit, 1000);

    let openingDebit = dec(0);
    let openingCredit = dec(0);

    if (fromDate) {
      const openingLines = await this.prisma.journalLine.findMany({
        where: {
          accountId,
          journalEntry: {
            ...where,
            date: { lt: fromDate },
          },
        },
        select: {
          side: true,
          amount: true,
        },
      });

      for (const line of openingLines) {
        if (line.side === "DEBIT") openingDebit = openingDebit.add(line.amount);
        else openingCredit = openingCredit.add(line.amount);
      }
    }

    const lines = await this.prisma.journalLine.findMany({
      where: {
        accountId,
        journalEntry: where,
      },
      orderBy: [
        { journalEntry: { date: "asc" } },
        { createdAt: "asc" },
      ],
      take: limit,
      include: {
        journalEntry: {
          select: {
            id: true,
            entryNumber: true,
            date: true,
            description: true,
            reference: true,
            status: true,
            period: { select: { id: true, name: true } },
          },
        },
      },
    });

    let runningBalance = dec(openingDebit.sub(openingCredit));
    let movementDebit = dec(0);
    let movementCredit = dec(0);

    const movements = lines.map((line) => {
      const debit = line.side === "DEBIT" ? dec(line.amount) : dec(0);
      const credit = line.side === "CREDIT" ? dec(line.amount) : dec(0);
      movementDebit = movementDebit.add(debit);
      movementCredit = movementCredit.add(credit);
      runningBalance = runningBalance.add(debit).sub(credit);

      return {
        id: line.id,
        date: line.journalEntry.date,
        entryId: line.journalEntry.id,
        entryNumber: line.journalEntry.entryNumber,
        description: line.journalEntry.description,
        reference: line.journalEntry.reference,
        status: line.journalEntry.status,
        period: line.journalEntry.period,
        debit: Number(debit.toFixed(2)),
        credit: Number(credit.toFixed(2)),
        balance: Number(runningBalance.toFixed(2)),
        memo: line.memo,
      };
    });

    return {
      filters: this.reportFiltersSummary(input),
      account: {
        id: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
      },
      opening: {
        debit: Number(openingDebit.toFixed(2)),
        credit: Number(openingCredit.toFixed(2)),
        balance: Number(openingDebit.sub(openingCredit).toFixed(2)),
      },
      totals: {
        debit: Number(movementDebit.toFixed(2)),
        credit: Number(movementCredit.toFixed(2)),
        closingBalance: Number(runningBalance.toFixed(2)),
      },
      movements,
    };
  }

  async getTrialBalanceReport(input: AccountingReportFiltersInput) {
    const where = this.buildReportWhere(input);
    const limit = this.parseLimit(input.limit, 5000);

    const lines = await this.prisma.journalLine.findMany({
      where: {
        journalEntry: where,
      },
      orderBy: [{ account: { code: "asc" } }],
      take: limit,
      include: {
        account: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            active: true,
          },
        },
      },
    });

    const byAccount = new Map<
      string,
      {
        account: {
          id: string;
          code: string;
          name: string;
          type: AccountingAccountType;
          active: boolean;
        };
        debit: Prisma.Decimal;
        credit: Prisma.Decimal;
      }
    >();

    for (const line of lines) {
      const key = line.accountId;
      const current =
        byAccount.get(key) ||
        ({
          account: line.account,
          debit: dec(0),
          credit: dec(0),
        } as {
          account: {
            id: string;
            code: string;
            name: string;
            type: AccountingAccountType;
            active: boolean;
          };
          debit: Prisma.Decimal;
          credit: Prisma.Decimal;
        });

      if (line.side === "DEBIT") {
        current.debit = current.debit.add(line.amount);
      } else {
        current.credit = current.credit.add(line.amount);
      }
      byAccount.set(key, current);
    }

    const rows = Array.from(byAccount.values())
      .map((row) => {
        const balance = row.debit.sub(row.credit);
        return {
          accountId: row.account.id,
          code: row.account.code,
          name: row.account.name,
          type: row.account.type,
          active: row.account.active,
          debit: Number(row.debit.toFixed(2)),
          credit: Number(row.credit.toFixed(2)),
          balance: Number(balance.toFixed(2)),
        };
      })
      .sort((a, b) => a.code.localeCompare(b.code));

    const totals = rows.reduce(
      (acc, row) => {
        acc.debit = Number(dec(acc.debit).add(row.debit).toFixed(2));
        acc.credit = Number(dec(acc.credit).add(row.credit).toFixed(2));
        return acc;
      },
      { debit: 0, credit: 0 },
    );

    return {
      filters: this.reportFiltersSummary(input),
      totals: {
        debit: totals.debit,
        credit: totals.credit,
        difference: Number(dec(totals.debit).sub(totals.credit).toFixed(2)),
      },
      rows,
    };
  }

  async getJournalEntry(entryId: string) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id: entryId },
      include: {
        period: true,
        createdBy: { select: { id: true, email: true } },
        postedBy: { select: { id: true, email: true } },
        lines: {
          orderBy: [{ createdAt: "asc" }],
          include: {
            account: true,
          },
        },
      },
    });

    if (!entry) {
      throw new NotFoundException("Asiento no encontrado.");
    }

    return entry;
  }

  async createJournalEntry(input: CreateJournalEntryInput, userId: string) {
    const date = input.date ? this.parseRequiredDate(input.date, "date") : new Date();
    const description = this.requiredText(input.description, "description", 500);
    const reference = this.optionalText(input.reference, 120);
    const sourceType = this.optionalText(input.sourceType, 80);
    const sourceId = this.optionalText(input.sourceId, 120);
    const currency = input.currency || "CUP";
    const status = input.status || "POSTED";
    const exchangeRateUsdToCup =
      input.exchangeRateUsdToCup !== undefined && input.exchangeRateUsdToCup !== null
        ? this.parsePositiveNumber(input.exchangeRateUsdToCup, "exchangeRateUsdToCup")
        : null;

    if (status === "VOID") {
      throw new BadRequestException("No se puede crear un asiento en estado VOID.");
    }

    const lines = this.normalizeJournalLines(input.lines);
    const totals = this.calculateLineTotals(lines);
    this.ensureBalancedTotals(totals.debit, totals.credit);

    const accountIds = Array.from(new Set(lines.map((line) => line.accountId)));
    const accounts = await this.prisma.accountingAccount.findMany({
      where: { id: { in: accountIds } },
      select: { id: true, active: true, allowManualEntries: true, code: true, name: true },
    });

    if (accounts.length !== accountIds.length) {
      throw new BadRequestException("Una o más cuentas contables no existen.");
    }

    const accountMap = new Map(accounts.map((account) => [account.id, account]));
    for (const line of lines) {
      const account = accountMap.get(line.accountId)!;
      if (!account.active) {
        throw new BadRequestException(`La cuenta ${account.code} - ${account.name} está inactiva.`);
      }
      if (!account.allowManualEntries) {
        throw new BadRequestException(`La cuenta ${account.code} no permite asientos manuales.`);
      }
    }

    const period = await this.resolveEntryPeriod(input.periodId, date);
    if (period.status !== "OPEN") {
      throw new BadRequestException(`El período ${period.name} está cerrado.`);
    }

    const entryNumber = this.buildEntryNumber();
    const now = new Date();

    return this.prisma.journalEntry.create({
      data: {
        entryNumber,
        date,
        description,
        reference,
        sourceType,
        sourceId,
        status,
        currency,
        exchangeRateUsdToCup: exchangeRateUsdToCup === null ? null : dec(exchangeRateUsdToCup.toString()),
        totalDebit: dec(totals.debit.toFixed(2)),
        totalCredit: dec(totals.credit.toFixed(2)),
        createdById: userId,
        postedById: status === "POSTED" ? userId : null,
        postedAt: status === "POSTED" ? now : null,
        periodId: period.id,
        lines: {
          create: lines.map((line) => ({
            accountId: line.accountId,
            side: line.side,
            amount: dec(line.amount.toFixed(2)),
            memo: line.memo,
          })),
        },
      },
      include: {
        period: true,
        createdBy: { select: { id: true, email: true } },
        postedBy: { select: { id: true, email: true } },
        lines: {
          include: {
            account: true,
          },
        },
      },
    });
  }

  async postJournalEntry(entryId: string, userId: string) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id: entryId },
      include: { lines: true, period: true },
    });

    if (!entry) {
      throw new NotFoundException("Asiento no encontrado.");
    }

    if (entry.status === "VOID") {
      throw new BadRequestException("No se puede publicar un asiento anulado.");
    }

    if (entry.status === "POSTED") {
      return this.getJournalEntry(entryId);
    }

    const totals = this.calculateLineTotals(
      entry.lines.map((line) => ({
        accountId: line.accountId,
        side: line.side,
        amount: Number(line.amount),
        memo: line.memo || undefined,
      })),
    );
    this.ensureBalancedTotals(totals.debit, totals.credit);

    if (!entry.period || entry.period.status !== "OPEN") {
      throw new BadRequestException("No se puede publicar en un período cerrado.");
    }

    await this.prisma.journalEntry.update({
      where: { id: entryId },
      data: {
        status: "POSTED",
        postedAt: new Date(),
        postedById: userId,
      },
    });

    return this.getJournalEntry(entryId);
  }

  async voidJournalEntry(entryId: string, input: VoidEntryInput) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id: entryId },
      include: { period: true },
    });

    if (!entry) {
      throw new NotFoundException("Asiento no encontrado.");
    }

    if (entry.status === "VOID") {
      return this.getJournalEntry(entryId);
    }

    if (entry.period && entry.period.status === "CLOSED") {
      throw new BadRequestException("No se puede anular un asiento de un período cerrado.");
    }

    await this.prisma.journalEntry.update({
      where: { id: entryId },
      data: {
        status: "VOID",
        voidedAt: new Date(),
        voidReason: this.optionalText(input.reason, 500),
      },
    });

    return this.getJournalEntry(entryId);
  }

  async postAutomatedSaleEntries(tx: Prisma.TransactionClient, saleId: string, userId: string) {
    const sale = await tx.sale.findUnique({
      where: { id: saleId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                cost: true,
                price: true,
                currency: true,
              },
            },
          },
        },
        payments: true,
      },
    });

    if (!sale) throw new NotFoundException("Venta no encontrada para contabilización.");

    await this.ensureCoreAutomationAccounts(tx);
    await this.ensureDefaultPostingRules(tx);
    const postingContext = await this.resolvePostingContext(tx, sale.createdAt, userId);

    await this.createSaleRevenueEntry(tx, sale, postingContext);
    await this.createSaleCostEntry(tx, sale, postingContext, userId);
  }

  async voidAutomatedSaleEntries(
    tx: Prisma.TransactionClient,
    saleId: string,
    reason?: string,
  ) {
    const entries = await tx.journalEntry.findMany({
      where: {
        sourceId: saleId,
        sourceType: { in: ["SALE_REVENUE", "SALE_COGS"] },
        status: { not: "VOID" },
      },
      include: {
        period: {
          select: { id: true, name: true, status: true },
        },
      },
    });

    if (!entries.length) return;

    const closed = entries.find((entry) => entry.period?.status === "CLOSED");
    if (closed) {
      throw new BadRequestException(
        `No se puede anular asiento automático ${closed.entryNumber} porque su período está cerrado.`,
      );
    }

    const voidReason =
      this.optionalText(reason, 500) || `Anulación automática por eliminación de venta ${saleId}`;

    await tx.journalEntry.updateMany({
      where: { id: { in: entries.map((entry) => entry.id) } },
      data: {
        status: "VOID",
        voidedAt: new Date(),
        voidReason,
      },
    });
  }

  async postAutomatedStockMovementEntry(
    tx: Prisma.TransactionClient,
    movementId: string,
    userId: string,
  ) {
    const movement = await tx.stockMovement.findUnique({
      where: { id: movementId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            cost: true,
            price: true,
            currency: true,
          },
        },
      },
    });

    if (!movement) throw new NotFoundException("Movimiento no encontrado para contabilización.");
    if (movement.type === "TRANSFER") return;
    if (this.isSystemGeneratedMovement(movement.reason)) return;

    const existing = await tx.journalEntry.findFirst({
      where: {
        sourceType: "STOCK_MOVEMENT",
        sourceId: movement.id,
      },
      select: { id: true },
    });
    if (existing) return;

    await this.ensureCoreAutomationAccounts(tx);
    await this.ensureDefaultPostingRules(tx);

    const unitCost = movement.product.cost
      ? dec(movement.product.cost)
      : movement.product.price
        ? dec(movement.product.price)
        : dec(0);
    const amount = dec(unitCost.mul(movement.qty).toFixed(2));
    if (amount.lte(0)) return;

    const postingContext = await this.resolvePostingContext(tx, movement.createdAt, userId);
    const ruleKey: AccountingPostingRuleKey =
      movement.type === "IN" ? "STOCK_IN" : "STOCK_OUT";
    const rule = await this.findPostingRuleOrThrow(tx, ruleKey);
    const debitAccount = rule.debitAccount;
    const creditAccount = rule.creditAccount;

    await tx.journalEntry.create({
      data: {
        entryNumber: this.buildEntryNumber(),
        date: movement.createdAt,
        description: `Movimiento inventario ${movement.type} - ${movement.product.name}`,
        reference: this.optionalText(movement.reason || undefined, 120),
        status: postingContext.status,
        sourceType: "STOCK_MOVEMENT",
        sourceId: movement.id,
        totalDebit: dec(amount.toFixed(2)),
        totalCredit: dec(amount.toFixed(2)),
        currency: movement.product.currency,
        createdById: userId,
        postedById: postingContext.postedById,
        postedAt: postingContext.postedAt,
        periodId: postingContext.periodId,
        lines: {
          create: [
            {
              accountId: debitAccount.id,
              side: "DEBIT",
              amount: dec(amount.toFixed(2)),
              memo: `Stock ${movement.type} ${movement.product.name}`,
            },
            {
              accountId: creditAccount.id,
              side: "CREDIT",
              amount: dec(amount.toFixed(2)),
              memo: `Stock ${movement.type} ${movement.product.name}`,
            },
          ],
        },
      },
    });
  }

  async voidAutomatedStockMovementEntry(
    tx: Prisma.TransactionClient,
    movementId: string,
    reason?: string,
  ) {
    const entry = await tx.journalEntry.findFirst({
      where: {
        sourceType: "STOCK_MOVEMENT",
        sourceId: movementId,
      },
      include: {
        period: {
          select: { id: true, name: true, status: true },
        },
      },
    });

    if (!entry || entry.status === "VOID") return;
    if (entry.period?.status === "CLOSED") {
      throw new BadRequestException(
        `No se puede anular asiento automático ${entry.entryNumber} porque su período está cerrado.`,
      );
    }

    await tx.journalEntry.update({
      where: { id: entry.id },
      data: {
        status: "VOID",
        voidedAt: new Date(),
        voidReason:
          this.optionalText(reason, 500) ||
          `Anulación automática por eliminación de movimiento ${movementId}`,
      },
    });
  }

  private async resolveEntryPeriod(periodId: string | undefined, date: Date) {
    if (periodId) {
      const period = await this.ensurePeriodExists(periodId);
      if (date < period.startDate || date > period.endDate) {
        throw new BadRequestException(`La fecha del asiento no cae dentro del período ${period.name}.`);
      }
      return period;
    }

    const period = await this.prisma.fiscalPeriod.findFirst({
      where: {
        status: "OPEN",
        startDate: { lte: date },
        endDate: { gte: date },
      },
      orderBy: [{ startDate: "desc" }],
    });

    if (!period) {
      throw new BadRequestException("No existe un período fiscal abierto para la fecha del asiento.");
    }

    return period;
  }

  private async createSaleRevenueEntry(
    tx: Prisma.TransactionClient,
    sale: any,
    postingContext: {
      status: JournalEntryStatus;
      postedAt: Date | null;
      postedById: string | null;
      periodId: string | null;
    },
  ) {
    if (!sale) return;

    const existing = await tx.journalEntry.findFirst({
      where: {
        sourceType: "SALE_REVENUE",
        sourceId: sale.id,
      },
      select: { id: true },
    });
    if (existing) return;

    const paymentCurrencies = Array.from(
      new Set<CurrencyCode>(
        (sale.payments || []).map((payment: any) =>
          this.normalizeCurrencyCodeSafe(payment.currency),
        ),
      ),
    );
    const entryCurrency: CurrencyCode =
      paymentCurrencies.length === 1 ? paymentCurrencies[0] : CurrencyCode.CUP;
    const ruleKey: AccountingPostingRuleKey =
      entryCurrency === CurrencyCode.USD ? "SALE_REVENUE_USD" : "SALE_REVENUE_CUP";
    const rule = await this.findPostingRuleOrThrow(tx, ruleKey);
    const cashAccount = rule.debitAccount;
    const salesAccount = rule.creditAccount;
    const amount = dec(sale.total);

    await tx.journalEntry.create({
      data: {
        entryNumber: this.buildEntryNumber(),
        date: sale.createdAt,
        description: `Venta ${sale.channel} ${sale.documentNumber || sale.id}`,
        reference: sale.documentNumber || sale.id,
        status: postingContext.status,
        sourceType: "SALE_REVENUE",
        sourceId: sale.id,
        totalDebit: dec(amount.toFixed(2)),
        totalCredit: dec(amount.toFixed(2)),
        currency: entryCurrency,
        createdById: sale.cashierId,
        postedById: postingContext.postedById,
        postedAt: postingContext.postedAt,
        periodId: postingContext.periodId,
        lines: {
          create: [
            {
              accountId: cashAccount.id,
              side: "DEBIT",
              amount: dec(amount.toFixed(2)),
              memo: `Cobro venta ${sale.documentNumber || sale.id}`,
            },
            {
              accountId: salesAccount.id,
              side: "CREDIT",
              amount: dec(amount.toFixed(2)),
              memo: `Ingreso venta ${sale.documentNumber || sale.id}`,
            },
          ],
        },
      },
    });
  }

  private async createSaleCostEntry(
    tx: Prisma.TransactionClient,
    sale: any,
    postingContext: {
      status: JournalEntryStatus;
      postedAt: Date | null;
      postedById: string | null;
      periodId: string | null;
    },
    userId: string,
  ) {
    if (!sale) return;

    const existing = await tx.journalEntry.findFirst({
      where: {
        sourceType: "SALE_COGS",
        sourceId: sale.id,
      },
      select: { id: true },
    });
    if (existing) return;

    const exchangeRate = await this.resolveSaleExchangeRate(tx, sale.id);

    let cogsTotalCup = dec(0);
    for (const item of sale.items || []) {
      const unitCost = item.product.cost ? dec(item.product.cost) : dec(0);
      if (unitCost.lte(0)) continue;
      let lineTotal = dec(unitCost.mul(item.qty).toFixed(2));

      if (item.product.currency === CurrencyCode.USD) {
        lineTotal = dec(lineTotal.mul(exchangeRate).toFixed(2));
      }
      cogsTotalCup = cogsTotalCup.add(lineTotal);
    }

    if (cogsTotalCup.lte(0)) return;

    const rule = await this.findPostingRuleOrThrow(tx, "SALE_COGS");
    const cogsAccount = rule.debitAccount;
    const inventoryAccount = rule.creditAccount;

    await tx.journalEntry.create({
      data: {
        entryNumber: this.buildEntryNumber(),
        date: sale.createdAt,
        description: `Costo de venta ${sale.documentNumber || sale.id}`,
        reference: sale.documentNumber || sale.id,
        status: postingContext.status,
        sourceType: "SALE_COGS",
        sourceId: sale.id,
        totalDebit: dec(cogsTotalCup.toFixed(2)),
        totalCredit: dec(cogsTotalCup.toFixed(2)),
        currency: CurrencyCode.CUP,
        exchangeRateUsdToCup: dec(exchangeRate.toFixed(6)),
        createdById: userId,
        postedById: postingContext.postedById,
        postedAt: postingContext.postedAt,
        periodId: postingContext.periodId,
        lines: {
          create: [
            {
              accountId: cogsAccount.id,
              side: "DEBIT",
              amount: dec(cogsTotalCup.toFixed(2)),
              memo: `Costo venta ${sale.documentNumber || sale.id}`,
            },
            {
              accountId: inventoryAccount.id,
              side: "CREDIT",
              amount: dec(cogsTotalCup.toFixed(2)),
              memo: `Salida inventario venta ${sale.documentNumber || sale.id}`,
            },
          ],
        },
      },
    });
  }

  private async resolvePostingContext(
    tx: Prisma.TransactionClient,
    date: Date,
    userId: string,
  ) {
    const period = await tx.fiscalPeriod.findFirst({
      where: {
        status: "OPEN",
        startDate: { lte: date },
        endDate: { gte: date },
      },
      orderBy: [{ startDate: "desc" }],
      select: { id: true },
    });

    const status: JournalEntryStatus = period ? "POSTED" : "DRAFT";
    return {
      status,
      postedAt: status === "POSTED" ? new Date() : null,
      postedById: status === "POSTED" ? userId : null,
      periodId: period?.id || null,
    };
  }

  private async resolveSaleExchangeRate(tx: Prisma.TransactionClient, saleId: string) {
    const paymentWithRate = await tx.payment.findFirst({
      where: {
        saleId,
        exchangeRateUsdToCup: { not: null },
      },
      orderBy: { id: "asc" },
      select: { exchangeRateUsdToCup: true },
    });

    if (paymentWithRate?.exchangeRateUsdToCup) {
      return dec(paymentWithRate.exchangeRateUsdToCup);
    }

    const systemSettings = await tx.systemSettings.findUnique({
      where: { id: "default" },
      select: { exchangeRateUsdToCup: true },
    });

    if (systemSettings?.exchangeRateUsdToCup) {
      return dec(systemSettings.exchangeRateUsdToCup);
    }

    return dec(1);
  }

  private async ensureCoreAutomationAccounts(tx: Prisma.TransactionClient) {
    const required: DefaultAccountSeed[] = [
      { code: "1101", name: "Caja CUP", type: "ASSET", description: "Efectivo en moneda CUP" },
      { code: "1102", name: "Caja USD", type: "ASSET", description: "Efectivo en moneda USD" },
      { code: "1301", name: "Inventario", type: "ASSET", description: "Inventario de mercancías" },
      { code: "2101", name: "Cuentas por pagar", type: "LIABILITY", description: "Obligaciones con terceros" },
      { code: "4101", name: "Ingresos por ventas", type: "INCOME", description: "Ventas de productos y servicios" },
      { code: "5101", name: "Costo de ventas", type: "EXPENSE", description: "Costo directo del inventario vendido" },
      { code: "5201", name: "Gastos operativos", type: "EXPENSE", description: "Gastos de operación" },
    ];

    for (const account of required) {
      await tx.accountingAccount.upsert({
        where: { code: account.code },
        update: {
          name: account.name,
          type: account.type,
          description: account.description || null,
          active: true,
        },
        create: {
          code: account.code,
          name: account.name,
          type: account.type,
          description: account.description || null,
          allowManualEntries: true,
          active: true,
        },
      });
    }
  }

  private async ensureDefaultPostingRules(tx: Prisma.TransactionClient) {
    for (const rule of DEFAULT_POSTING_RULES) {
      const debitAccount = await this.findAccountByCodeOrThrow(tx, rule.debitAccountCode);
      const creditAccount = await this.findAccountByCodeOrThrow(tx, rule.creditAccountCode);

      await tx.accountingPostingRule.upsert({
        where: { key: rule.key },
        update: {
          name: rule.name,
          description: rule.description,
        },
        create: {
          key: rule.key,
          name: rule.name,
          description: rule.description,
          active: true,
          debitAccountId: debitAccount.id,
          creditAccountId: creditAccount.id,
        },
      });
    }
  }

  private async findPostingRuleOrThrow(
    tx: Prisma.TransactionClient,
    key: AccountingPostingRuleKey,
  ) {
    const rule = await tx.accountingPostingRule.findUnique({
      where: { key },
      include: {
        debitAccount: {
          select: { id: true, code: true, name: true, active: true },
        },
        creditAccount: {
          select: { id: true, code: true, name: true, active: true },
        },
      },
    });

    if (!rule) {
      throw new BadRequestException(`No existe regla contable para ${key}.`);
    }
    if (!rule.active) {
      throw new BadRequestException(`La regla contable ${key} está inactiva.`);
    }
    if (!rule.debitAccount.active) {
      throw new BadRequestException(
        `La cuenta débito de la regla ${key} está inactiva.`,
      );
    }
    if (!rule.creditAccount.active) {
      throw new BadRequestException(
        `La cuenta crédito de la regla ${key} está inactiva.`,
      );
    }

    return rule;
  }

  private async findAccountByCodeOrThrow(tx: Prisma.TransactionClient, code: string) {
    const account = await tx.accountingAccount.findUnique({
      where: { code },
      select: { id: true, code: true, active: true },
    });

    if (!account || !account.active) {
      throw new BadRequestException(`Cuenta contable ${code} no existe o está inactiva.`);
    }
    return account;
  }

  private isSystemGeneratedMovement(reason?: string | null): boolean {
    const value = (reason || "").trim().toUpperCase();
    if (!value) return false;
    return (
      value === "VENTA" ||
      value === "VENTA_DIRECTA" ||
      value.startsWith("ELIMINACION_VENTA:") ||
      value.startsWith("RESET_STOCK:")
    );
  }

  private normalizeCurrencyCodeSafe(value: unknown): CurrencyCode {
    const raw = String(value || "").toUpperCase().trim();
    if (raw === CurrencyCode.USD) return CurrencyCode.USD;
    return CurrencyCode.CUP;
  }

  private buildReportWhere(input: AccountingReportFiltersInput): Prisma.JournalEntryWhereInput {
    const fromDate = this.parseOptionalDate(input.fromDate, "fromDate");
    const toDate = this.parseOptionalDate(input.toDate, "toDate");
    const includeDraft = this.parseOptionalBoolean(input.includeDraft) === true;
    const includeVoid = this.parseOptionalBoolean(input.includeVoid) === true;

    if (fromDate && toDate && fromDate > toDate) {
      throw new BadRequestException("Rango de fechas inválido.");
    }

    const statuses: JournalEntryStatus[] = ["POSTED"];
    if (includeDraft) statuses.push("DRAFT");
    if (includeVoid) statuses.push("VOID");

    return {
      ...(input.periodId ? { periodId: input.periodId } : {}),
      status: { in: statuses },
      ...(fromDate || toDate
        ? {
            date: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
    };
  }

  private reportFiltersSummary(input: AccountingReportFiltersInput) {
    return {
      periodId: input.periodId || null,
      fromDate: input.fromDate || null,
      toDate: input.toDate || null,
      includeDraft: this.parseOptionalBoolean(input.includeDraft) === true,
      includeVoid: this.parseOptionalBoolean(input.includeVoid) === true,
    };
  }

  private normalizeJournalLines(lines: JournalLineInput[]) {
    if (!Array.isArray(lines) || lines.length < 2) {
      throw new BadRequestException("El asiento debe tener al menos 2 líneas.");
    }

    return lines.map((line, index) => {
      const accountId = this.requiredText(line.accountId, `lines[${index}].accountId`, 100);
      const amount = this.parsePositiveNumber(line.amount, `lines[${index}].amount`);
      const memo = this.optionalText(line.memo, 300);
      return {
        accountId,
        side: line.side,
        amount: Number(amount.toFixed(2)),
        memo,
      };
    });
  }

  private calculateLineTotals(lines: Array<{ side: JournalLineSide; amount: number }>) {
    let debit = dec(0);
    let credit = dec(0);

    for (const line of lines) {
      if (line.side === "DEBIT") {
        debit = debit.plus(dec(line.amount.toFixed(2)));
      } else {
        credit = credit.plus(dec(line.amount.toFixed(2)));
      }
    }

    return {
      debit: Number(debit.toFixed(2)),
      credit: Number(credit.toFixed(2)),
    };
  }

  private ensureBalancedTotals(debit: number, credit: number) {
    if (Math.abs(debit - credit) > 0.0001) {
      throw new BadRequestException("El asiento no está balanceado: Débito y Crédito deben ser iguales.");
    }
  }

  private buildEntryNumber() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `JE-${y}${m}${d}-${hh}${mm}${ss}-${rnd}`;
  }

  private parsePositiveNumber(value: number, fieldName: string) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new BadRequestException(`${fieldName} debe ser un número mayor a 0.`);
    }
    return parsed;
  }

  private parseRequiredDate(value: string, fieldName: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${fieldName} no es una fecha válida.`);
    }
    return date;
  }

  private parseOptionalDate(value: string | undefined, fieldName: string) {
    if (!value) return null;
    return this.parseRequiredDate(value, fieldName);
  }

  private parseOptionalBoolean(value: string | undefined): boolean | null {
    if (value === undefined || value === null || value === "") return null;
    if (value === "true") return true;
    if (value === "false") return false;
    throw new BadRequestException("Parámetro active inválido. Use true o false.");
  }

  private parseLimit(value: string | undefined, fallback: number) {
    if (!value) return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new BadRequestException("Parámetro limit inválido.");
    }
    return Math.min(1000, Math.floor(parsed));
  }

  private normalize(value?: string | null) {
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }

  private requiredText(value: string, fieldName: string, maxLength: number) {
    const normalized = this.normalize(value);
    if (!normalized) {
      throw new BadRequestException(`${fieldName} es requerido.`);
    }
    return normalized.slice(0, maxLength);
  }

  private optionalText(value: string | undefined, maxLength: number) {
    const normalized = this.normalize(value);
    return normalized ? normalized.slice(0, maxLength) : null;
  }

  private normalizeAccountCode(code: string) {
    const normalized = this.requiredText(code, "code", 30).toUpperCase();
    return normalized.replace(/\s+/g, "");
  }

  private buildPeriodName(startDate: Date, endDate: Date) {
    const start = startDate.toISOString().slice(0, 10);
    const end = endDate.toISOString().slice(0, 10);
    return `Período ${start} a ${end}`;
  }

  private async ensureAccountExists(accountId: string) {
    const account = await this.prisma.accountingAccount.findUnique({
      where: { id: accountId },
    });
    if (!account) throw new NotFoundException("Cuenta contable no encontrada.");
    return account;
  }

  private async ensurePeriodExists(periodId: string) {
    const period = await this.prisma.fiscalPeriod.findUnique({
      where: { id: periodId },
    });
    if (!period) throw new NotFoundException("Período fiscal no encontrado.");
    return period;
  }
}
