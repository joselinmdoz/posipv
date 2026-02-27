import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma, SaleChannel } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { dec } from "../../common/decimal";

type SalesReportFilters = {
  channel?: string;
  warehouseId?: string;
  cashierEmail?: string;
  customerName?: string;
  documentNumber?: string;
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
        qty: item.qty,
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

    return {
      serverDate: range.serverDate,
      serverTimezone: range.serverTimezone,
      startDate: range.startDate,
      endDate: range.endDate,
      totalSales: sales.length,
      totalAmount: Number(sales.reduce((sum, sale) => sum.add(sale.total), dec(0)).toFixed(2)),
      averageTicket:
        sales.length > 0
          ? Number((sales.reduce((sum, sale) => sum.add(sale.total), dec(0)).toNumber() / sales.length).toFixed(2))
          : 0,
      salesByPaymentMethod: this.groupSalesByPaymentMethod(detailedSales),
      salesByCashier: this.groupSalesByCashier(detailedSales),
      detailedSales,
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
