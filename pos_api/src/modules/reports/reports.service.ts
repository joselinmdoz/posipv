import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma, PurchaseLotSource, SaleChannel, SaleStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { dec } from "../../common/decimal";

type SalesReportFilters = {
  channel?: string;
  warehouseId?: string;
  cashierEmail?: string;
  customerName?: string;
  documentNumber?: string;
  includeManualIvp?: string | boolean;
};

type LotProfitFilters = {
  channel?: string;
  warehouseId?: string;
  productId?: string;
  purchaseId?: string;
  includeAdjustments?: string | boolean;
};

type DetailedSale = {
  id: string;
  createdAt: Date;
  createdAtServer: string;
  status: string;
  channel: string;
  total: number;
  cashierId: string;
  cashSessionId: string | null;
  warehouseId: string | null;
  warehouse: {
    id: string;
    name: string;
    code: string;
    type: string;
  } | null;
  customerName: string | null;
  documentNumber: string | null;
  items: Array<{
    id: string;
    saleId: string;
    productId: string;
    qty: number;
    price: number;
    product: {
      id: string;
      name: string;
      codigo: string | null;
      barcode: string | null;
      currency: string;
    };
  }>;
  payments: Array<{
    id: string;
    saleId: string;
    method: string;
    amount: number; // monto en moneda base (CUP)
    currency: string;
    amountOriginal: number;
    exchangeRateUsdToCup: number | null;
    exchangeRateRecordId: string | null;
  }>;
  cashier: {
    id: string;
    email: string;
    role: string;
    active: boolean;
    createdAt: Date;
  };
};

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getSalesReport(startDate?: string, endDate?: string, filters: SalesReportFilters = {}) {
    const range = this.resolveDateRange(startDate, endDate);
    const where = this.buildSalesWhere(range.start, range.end, filters);
    const sales = await this.prisma.sale.findMany({
      where,
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                codigo: true,
                barcode: true,
                currency: true,
              },
            },
          },
        },
        payments: true,
        warehouse: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
          },
        },
        cashier: {
          select: {
            id: true,
            email: true,
            role: true,
            active: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const detailedSales: DetailedSale[] = sales.map((sale) => ({
      id: sale.id,
      createdAt: sale.createdAt,
      createdAtServer: this.formatServerDateTime(sale.createdAt),
      status: sale.status,
      channel: sale.channel,
      total: Number(sale.total.toFixed(2)),
      cashierId: sale.cashierId,
      cashSessionId: sale.cashSessionId,
      warehouseId: sale.warehouseId,
      warehouse: sale.warehouse
        ? {
            id: sale.warehouse.id,
            name: sale.warehouse.name,
            code: sale.warehouse.code,
            type: sale.warehouse.type,
          }
        : null,
      customerName: sale.customerName || null,
      documentNumber: sale.documentNumber || null,
      items: sale.items.map((item) => ({
        id: item.id,
        saleId: item.saleId,
        productId: item.productId,
        qty: Number(item.qty),
        price: Number(item.price.toFixed(2)),
        product: {
          id: item.product.id,
          name: item.product.name,
          codigo: item.product.codigo,
          barcode: item.product.barcode,
          currency: item.product.currency,
        },
      })),
      payments: sale.payments.map((payment) => ({
        id: payment.id,
        saleId: payment.saleId,
        method: payment.method,
        amount: Number(payment.amount.toFixed(2)),
        currency: payment.currency,
        amountOriginal: Number(payment.amountOriginal.toFixed(2)),
        exchangeRateUsdToCup: payment.exchangeRateUsdToCup ? Number(payment.exchangeRateUsdToCup.toFixed(6)) : null,
        exchangeRateRecordId: payment.exchangeRateRecordId || null,
      })),
      cashier: sale.cashier,
    }));

    const includeManualIvp = this.parseIncludeManualIvpFlag(filters.includeManualIvp);
    const channel = this.parseChannelFilter(filters.channel);
    const shouldIncludeManualIvp = includeManualIvp && channel !== SaleChannel.DIRECT;
    const warehouseId = this.cleanFilter(filters.warehouseId);
    const manualIvpSummary = shouldIncludeManualIvp
      ? await this.getManualIvpSummary(range.start, range.end, warehouseId || undefined)
      : { count: 0, amount: 0, paymentTotals: {} as Record<string, number> };

    const salesAmount = Number(sales.reduce((sum, sale) => sum.add(sale.total), dec(0)).toFixed(2));
    const totalAmount = Number((salesAmount + Number(manualIvpSummary.amount || 0)).toFixed(2));
    const salesByPaymentMethod = this.mergePaymentMethodTotals(
      this.groupSalesByPaymentMethod(detailedSales),
      manualIvpSummary.paymentTotals,
    );

    return {
      serverDate: range.serverDate,
      serverTimezone: range.serverTimezone,
      startDate: range.startDate,
      endDate: range.endDate,
      totalSales: sales.length,
      totalAmount,
      averageTicket:
        sales.length > 0
          ? Number((sales.reduce((sum, sale) => sum.add(sale.total), dec(0)).toNumber() / sales.length).toFixed(2))
          : 0,
      salesByPaymentMethod,
      salesByCashier: this.groupSalesByCashier(detailedSales),
      manualIvpIncluded: shouldIncludeManualIvp,
      manualIvpCount: manualIvpSummary.count,
      manualIvpAmount: Number(manualIvpSummary.amount || 0),
      detailedSales,
    };
  }

  async getLotProfitReport(startDate?: string, endDate?: string, filters: LotProfitFilters = {}) {
    const range = this.resolveDateRange(startDate, endDate);
    const channel = this.parseChannelFilter(filters.channel);
    const warehouseId = this.cleanFilter(filters.warehouseId);
    const productId = this.cleanFilter(filters.productId);
    const purchaseId = this.cleanFilter(filters.purchaseId);
    const includeAdjustments = this.parseFlexibleBoolean(filters.includeAdjustments, true);

    const andWhere: Prisma.SaleItemLotConsumptionWhereInput[] = [
      {
        saleItem: {
          sale: {
            createdAt: { gte: range.start, lte: range.end },
            status: { not: SaleStatus.VOID },
            ...(channel ? { channel } : {}),
            ...(warehouseId ? { warehouseId } : {}),
          },
        },
      },
    ];

    if (productId) {
      andWhere.push({ saleItem: { productId } });
    }
    if (purchaseId) {
      andWhere.push({ purchaseLot: { purchaseId } });
    }
    if (!includeAdjustments) {
      andWhere.push({ purchaseLot: { source: PurchaseLotSource.PURCHASE } });
    }

    const rows = await this.prisma.saleItemLotConsumption.findMany({
      where: { AND: andWhere },
      select: {
        qty: true,
        lineCost: true,
        lineRevenue: true,
        saleItem: {
          select: {
            saleId: true,
            productId: true,
            product: {
              select: {
                id: true,
                name: true,
                codigo: true,
                currency: true,
              },
            },
            sale: {
              select: {
                id: true,
                createdAt: true,
                channel: true,
                warehouseId: true,
                warehouse: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                  },
                },
              },
            },
          },
        },
        purchaseLot: {
          select: {
            id: true,
            source: true,
            reference: true,
            receivedAt: true,
            purchaseId: true,
            warehouseId: true,
            warehouse: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            purchase: {
              select: {
                id: true,
                documentNumber: true,
                supplierName: true,
                createdAt: true,
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: "asc" }],
    });

    const byLotMap = new Map<
      string,
      {
        lotId: string;
        source: string;
        reference: string | null;
        receivedAt: Date;
        purchaseId: string | null;
        purchaseDocumentNumber: string | null;
        purchaseSupplierName: string | null;
        purchaseCreatedAt: Date | null;
        warehouse: { id: string; name: string; code: string } | null;
        product: { id: string; name: string; codigo: string | null; currency: string };
        qtySold: number;
        revenue: number;
        cost: number;
        profit: number;
        saleIds: Set<string>;
      }
    >();

    const byPurchaseMap = new Map<
      string,
      {
        purchaseId: string | null;
        purchaseDocumentNumber: string | null;
        purchaseSupplierName: string | null;
        purchaseCreatedAt: Date | null;
        source: string;
        currency: string;
        qtySold: number;
        revenue: number;
        cost: number;
        profit: number;
        lots: Set<string>;
      }
    >();

    const totalsByCurrencyMap = new Map<string, { currency: string; revenue: number; cost: number; profit: number }>();

    for (const row of rows) {
      const lot = row.purchaseLot;
      const saleItem = row.saleItem;
      const product = saleItem.product;
      const currency = String(product.currency || "CUP").toUpperCase();
      const qty = Number(dec(row.qty).toFixed(3));
      const lineCost = Number(dec(row.lineCost).toFixed(2));
      const lineRevenue = Number(dec(row.lineRevenue).toFixed(2));
      const lineProfit = Number((lineRevenue - lineCost).toFixed(2));

      const lotKey = lot.id;
      const existingLot = byLotMap.get(lotKey);
      if (!existingLot) {
        byLotMap.set(lotKey, {
          lotId: lot.id,
          source: lot.source,
          reference: lot.reference || null,
          receivedAt: lot.receivedAt,
          purchaseId: lot.purchaseId || null,
          purchaseDocumentNumber: lot.purchase?.documentNumber || null,
          purchaseSupplierName: lot.purchase?.supplierName || null,
          purchaseCreatedAt: lot.purchase?.createdAt || null,
          warehouse: lot.warehouse
            ? { id: lot.warehouse.id, name: lot.warehouse.name, code: lot.warehouse.code }
            : null,
          product: {
            id: product.id,
            name: product.name,
            codigo: product.codigo,
            currency,
          },
          qtySold: qty,
          revenue: lineRevenue,
          cost: lineCost,
          profit: lineProfit,
          saleIds: new Set([saleItem.saleId]),
        });
      } else {
        existingLot.qtySold = Number((existingLot.qtySold + qty).toFixed(3));
        existingLot.revenue = Number((existingLot.revenue + lineRevenue).toFixed(2));
        existingLot.cost = Number((existingLot.cost + lineCost).toFixed(2));
        existingLot.profit = Number((existingLot.revenue - existingLot.cost).toFixed(2));
        existingLot.saleIds.add(saleItem.saleId);
      }

      const purchaseKey = `${lot.purchaseId || "NO_PURCHASE"}::${currency}`;
      const existingPurchase = byPurchaseMap.get(purchaseKey);
      if (!existingPurchase) {
        byPurchaseMap.set(purchaseKey, {
          purchaseId: lot.purchaseId || null,
          purchaseDocumentNumber: lot.purchase?.documentNumber || null,
          purchaseSupplierName: lot.purchase?.supplierName || null,
          purchaseCreatedAt: lot.purchase?.createdAt || null,
          source: lot.source,
          currency,
          qtySold: qty,
          revenue: lineRevenue,
          cost: lineCost,
          profit: lineProfit,
          lots: new Set([lot.id]),
        });
      } else {
        existingPurchase.qtySold = Number((existingPurchase.qtySold + qty).toFixed(3));
        existingPurchase.revenue = Number((existingPurchase.revenue + lineRevenue).toFixed(2));
        existingPurchase.cost = Number((existingPurchase.cost + lineCost).toFixed(2));
        existingPurchase.profit = Number((existingPurchase.revenue - existingPurchase.cost).toFixed(2));
        existingPurchase.lots.add(lot.id);
      }

      const currentTotals = totalsByCurrencyMap.get(currency) || {
        currency,
        revenue: 0,
        cost: 0,
        profit: 0,
      };
      currentTotals.revenue = Number((currentTotals.revenue + lineRevenue).toFixed(2));
      currentTotals.cost = Number((currentTotals.cost + lineCost).toFixed(2));
      currentTotals.profit = Number((currentTotals.revenue - currentTotals.cost).toFixed(2));
      totalsByCurrencyMap.set(currency, currentTotals);
    }

    const byLot = Array.from(byLotMap.values())
      .map((row) => ({
        lotId: row.lotId,
        source: row.source,
        reference: row.reference,
        receivedAt: row.receivedAt,
        purchaseId: row.purchaseId,
        purchaseDocumentNumber: row.purchaseDocumentNumber,
        purchaseSupplierName: row.purchaseSupplierName,
        purchaseCreatedAt: row.purchaseCreatedAt,
        warehouse: row.warehouse,
        product: row.product,
        salesCount: row.saleIds.size,
        qtySold: Number(row.qtySold.toFixed(3)),
        revenue: Number(row.revenue.toFixed(2)),
        cost: Number(row.cost.toFixed(2)),
        profit: Number(row.profit.toFixed(2)),
      }))
      .sort((a, b) => {
        const dateDiff = new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime();
        if (dateDiff !== 0) return dateDiff;
        return (a.product?.name || "").localeCompare(b.product?.name || "");
      });

    const byPurchase = Array.from(byPurchaseMap.values())
      .map((row) => ({
        purchaseId: row.purchaseId,
        purchaseDocumentNumber: row.purchaseDocumentNumber,
        purchaseSupplierName: row.purchaseSupplierName,
        purchaseCreatedAt: row.purchaseCreatedAt,
        source: row.source,
        currency: row.currency,
        lotsCount: row.lots.size,
        qtySold: Number(row.qtySold.toFixed(3)),
        revenue: Number(row.revenue.toFixed(2)),
        cost: Number(row.cost.toFixed(2)),
        profit: Number(row.profit.toFixed(2)),
      }))
      .sort((a, b) => {
        const aDate = a.purchaseCreatedAt ? new Date(a.purchaseCreatedAt).getTime() : 0;
        const bDate = b.purchaseCreatedAt ? new Date(b.purchaseCreatedAt).getTime() : 0;
        if (aDate !== bDate) return aDate - bDate;
        return (a.purchaseDocumentNumber || "").localeCompare(b.purchaseDocumentNumber || "");
      });

    const totalsByCurrency = Array.from(totalsByCurrencyMap.values()).sort((a, b) =>
      a.currency.localeCompare(b.currency),
    );

    return {
      serverDate: range.serverDate,
      serverTimezone: range.serverTimezone,
      startDate: range.startDate,
      endDate: range.endDate,
      filtersApplied: {
        channel: channel || null,
        warehouseId: warehouseId || null,
        productId: productId || null,
        purchaseId: purchaseId || null,
        includeAdjustments,
      },
      totalsByCurrency,
      byPurchase,
      byLot,
    };
  }

  private buildSalesWhere(start: Date, end: Date, filters: SalesReportFilters): Prisma.SaleWhereInput {
    const where: Prisma.SaleWhereInput = {
      createdAt: {
        gte: start,
        lte: end,
      },
      status: { not: "VOID" },
    };

    const channel = this.parseChannelFilter(filters.channel);
    if (channel) {
      where.channel = channel;
    }

    const warehouseId = this.cleanFilter(filters.warehouseId);
    if (warehouseId) {
      where.warehouseId = warehouseId;
    }

    const cashierEmail = this.cleanFilter(filters.cashierEmail);
    if (cashierEmail) {
      where.cashier = {
        email: { contains: cashierEmail, mode: "insensitive" },
      };
    }

    const customerName = this.cleanFilter(filters.customerName);
    if (customerName) {
      where.customerName = { contains: customerName, mode: "insensitive" };
    }

    const documentNumber = this.cleanFilter(filters.documentNumber);
    if (documentNumber) {
      where.documentNumber = { contains: documentNumber, mode: "insensitive" };
    }

    return where;
  }

  private parseChannelFilter(channel?: string): SaleChannel | null {
    const normalized = this.cleanFilter(channel)?.toUpperCase();
    if (!normalized) return null;
    if (normalized === "TPV" || normalized === "DIRECT") {
      return normalized;
    }
    throw new BadRequestException("Filtro channel invalido. Use TPV o DIRECT.");
  }

  private cleanFilter(value?: string | null): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }

  getServerDateInfo() {
    const now = new Date();
    return {
      serverDate: this.formatServerDateOnly(now),
      serverTimezone: this.getServerTimezone(),
      serverNow: now.toISOString(),
      serverNowLabel: this.formatServerDateTime(now),
    };
  }

  private groupSalesByPaymentMethod(sales: DetailedSale[]) {
    const paymentMethodTotals: Record<string, { method: string; currency: string; amountOriginal: number; amountBase: number }> = {};

    for (const sale of sales) {
      for (const payment of sale.payments) {
        const method = payment.method || "OTHER";
        const currency = payment.currency || "CUP";
        const key = `${method}::${currency}`;

        if (!paymentMethodTotals[key]) {
          paymentMethodTotals[key] = {
            method,
            currency,
            amountOriginal: 0,
            amountBase: 0,
          };
        }
        paymentMethodTotals[key].amountOriginal += Number(payment.amountOriginal || 0);
        paymentMethodTotals[key].amountBase += Number(payment.amount || 0);
      }
    }

    return Object.values(paymentMethodTotals)
      .map((row) => ({
        method: row.method,
        currency: row.currency,
        amountOriginal: Number(row.amountOriginal.toFixed(2)),
        amountBase: Number(row.amountBase.toFixed(2)),
      }))
      .sort((a, b) => {
        const methodOrder = a.method.localeCompare(b.method);
        if (methodOrder !== 0) return methodOrder;
        return a.currency.localeCompare(b.currency);
      });
  }

  private async getManualIvpSummary(start: Date, end: Date, warehouseId?: string) {
    const reports = await this.prisma.manualIvpReport.findMany({
      where: {
        reportDate: {
          gte: start,
          lte: end,
        },
        ...(warehouseId ? { warehouseId } : {}),
      },
      select: {
        paymentBreakdown: true,
        lines: {
          select: {
            amount: true,
          },
        },
      },
    });

    const paymentTotals: Record<string, number> = {};
    let amount = 0;

    for (const report of reports) {
      for (const line of report.lines || []) {
        amount += Number(line.amount || 0);
      }

      const breakdown = report.paymentBreakdown && typeof report.paymentBreakdown === "object"
        ? (report.paymentBreakdown as Record<string, unknown>)
        : {};

      for (const [code, value] of Object.entries(breakdown)) {
        const normalizedCode = this.normalizePaymentMethodCode(code);
        const numeric = Number(value || 0);
        if (!Number.isFinite(numeric) || numeric === 0) continue;
        paymentTotals[normalizedCode] = Number(((paymentTotals[normalizedCode] || 0) + numeric).toFixed(2));
      }
    }

    return {
      count: reports.length,
      amount: Number(amount.toFixed(2)),
      paymentTotals,
    };
  }

  private mergePaymentMethodTotals(
    salesRows: Array<{ method: string; currency: string; amountOriginal: number; amountBase: number }>,
    manualPaymentTotals: Record<string, number>,
  ) {
    const map = new Map<string, { method: string; currency: string; amountOriginal: number; amountBase: number }>();

    for (const row of salesRows) {
      const method = this.normalizePaymentMethodCode(row.method);
      const currency = String(row.currency || "CUP").toUpperCase();
      const key = `${method}::${currency}`;
      map.set(key, {
        method,
        currency,
        amountOriginal: Number(row.amountOriginal || 0),
        amountBase: Number(row.amountBase || 0),
      });
    }

    for (const [code, value] of Object.entries(manualPaymentTotals || {})) {
      const method = this.normalizePaymentMethodCode(code);
      const numeric = Number(value || 0);
      if (!Number.isFinite(numeric) || numeric === 0) continue;
      const key = `${method}::CUP`;
      const existing = map.get(key);
      if (existing) {
        existing.amountOriginal = Number((existing.amountOriginal + numeric).toFixed(2));
        existing.amountBase = Number((existing.amountBase + numeric).toFixed(2));
      } else {
        map.set(key, {
          method,
          currency: "CUP",
          amountOriginal: Number(numeric.toFixed(2)),
          amountBase: Number(numeric.toFixed(2)),
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      const methodOrder = a.method.localeCompare(b.method);
      if (methodOrder !== 0) return methodOrder;
      return a.currency.localeCompare(b.currency);
    });
  }

  private parseIncludeManualIvpFlag(value?: string | boolean) {
    if (typeof value === "boolean") return value;
    const normalized = String(value ?? "").trim().toLowerCase();
    if (!normalized) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    return true;
  }

  private parseFlexibleBoolean(value: string | boolean | undefined, defaultValue: boolean) {
    if (typeof value === "boolean") return value;
    const normalized = String(value ?? "").trim().toLowerCase();
    if (!normalized) return defaultValue;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    return defaultValue;
  }

  private normalizePaymentMethodCode(code?: string | null) {
    const normalized = String(code || "").trim().toUpperCase();
    switch (normalized) {
      case "EFECTIVO":
      case "CASH":
        return "CASH";
      case "TARJETA":
      case "CARD":
        return "CARD";
      case "TRANSFERENCIA":
      case "TRANSFER":
        return "TRANSFER";
      case "OTRO":
      case "OTHER":
      default:
        return normalized || "OTHER";
    }
  }

  private groupSalesByCashier(sales: DetailedSale[]) {
    const cashierTotals: Record<string, { name: string; sales: number; amount: number }> = {};

    for (const sale of sales) {
      const cashierId = sale.cashierId;
      if (!cashierTotals[cashierId]) {
        cashierTotals[cashierId] = {
          name: sale.cashier.email,
          sales: 0,
          amount: 0,
        };
      }
      cashierTotals[cashierId].sales += 1;
      cashierTotals[cashierId].amount += Number(sale.total || 0);
    }

    return Object.values(cashierTotals).map((row) => ({
      ...row,
      amount: Number(row.amount.toFixed(2)),
    }));
  }

  private resolveDateRange(startDate?: string, endDate?: string) {
    const now = new Date();
    const today = this.formatServerDateOnly(now);

    const effectiveStartDate = startDate || endDate || today;
    const effectiveEndDate = endDate || startDate || today;

    const start = this.parseServerDate(effectiveStartDate, false);
    const end = this.parseServerDate(effectiveEndDate, true);

    if (start.getTime() > end.getTime()) {
      throw new BadRequestException("startDate no puede ser mayor que endDate.");
    }

    return {
      start,
      end,
      startDate: effectiveStartDate,
      endDate: effectiveEndDate,
      serverDate: today,
      serverTimezone: this.getServerTimezone(),
    };
  }

  private parseServerDate(dateInput: string, endOfDay: boolean): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      throw new BadRequestException("Formato de fecha inválido. Use YYYY-MM-DD.");
    }

    const [yearText, monthText, dayText] = dateInput.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);

    const date = endOfDay
      ? new Date(year, month - 1, day, 23, 59, 59, 999)
      : new Date(year, month - 1, day, 0, 0, 0, 0);

    if (
      Number.isNaN(date.getTime()) ||
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      throw new BadRequestException("Fecha inválida.");
    }

    return date;
  }

  private formatServerDateOnly(date: Date) {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private formatServerDateTime(date: Date) {
    const formatter = new Intl.DateTimeFormat("es-ES", {
      timeZone: this.getServerTimezone(),
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return formatter.format(date);
  }

  private getServerTimezone() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  }
}
