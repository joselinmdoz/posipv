import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { dec } from "../../common/decimal";

type DetailedSale = {
  id: string;
  createdAt: Date;
  createdAtServer: string;
  status: string;
  total: number;
  cashierId: string;
  cashSessionId: string;
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
    };
  }>;
  payments: Array<{
    id: string;
    saleId: string;
    method: string;
    amount: number;
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

  async getSalesReport(startDate?: string, endDate?: string) {
    const range = this.resolveDateRange(startDate, endDate);
    const sales = await this.prisma.sale.findMany({
      where: {
        createdAt: {
          gte: range.start,
          lte: range.end,
        },
        status: { not: "VOID" },
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                codigo: true,
                barcode: true,
              },
            },
          },
        },
        payments: true,
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
      total: Number(sale.total.toFixed(2)),
      cashierId: sale.cashierId,
      cashSessionId: sale.cashSessionId,
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
        },
      })),
      payments: sale.payments.map((payment) => ({
        id: payment.id,
        saleId: payment.saleId,
        method: payment.method,
        amount: Number(payment.amount.toFixed(2)),
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
    const paymentMethodTotals: Record<string, number> = {};

    for (const sale of sales) {
      for (const payment of sale.payments) {
        if (!paymentMethodTotals[payment.method]) {
          paymentMethodTotals[payment.method] = 0;
        }
        paymentMethodTotals[payment.method] += Number(payment.amount || 0);
      }
    }

    return Object.entries(paymentMethodTotals).map(([method, amount]) => ({
      method,
      amount: Number(amount.toFixed(2)),
    }));
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
