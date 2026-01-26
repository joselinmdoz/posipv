import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { Prisma } from "@prisma/client";
import { dec } from "../../common/decimal";

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getSalesReport(startDate: Date, endDate: Date) {
    const sales = await this.prisma.sale.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        status: { not: "VOID" },
      },
      include: {
        items: true,
        payments: true,
        cashier: true,
      },
    });

    return {
      totalSales: sales.length,
      totalAmount: parseFloat(
        sales.reduce((sum, sale) => sum.add(sale.total), dec(0)).toFixed(2)
      ),
      averageTicket: sales.length > 0 
        ? parseFloat((sales.reduce((sum, sale) => sum.add(sale.total), dec(0)).toNumber() / sales.length).toFixed(2)) 
        : 0,
      salesByPaymentMethod: this.groupSalesByPaymentMethod(sales),
      salesByCashier: this.groupSalesByCashier(sales),
      detailedSales: sales,
    };
  }

  private groupSalesByPaymentMethod(sales: any[]) {
    const paymentMethodTotals: Record<string, number> = {};

    sales.forEach((sale) => {
      sale.payments.forEach((payment: any) => {
        const method = payment.method;
        if (!paymentMethodTotals[method]) {
          paymentMethodTotals[method] = 0;
        }
        paymentMethodTotals[method] += parseFloat(payment.amount.toFixed(2));
      });
    });

    return Object.entries(paymentMethodTotals).map(([method, amount]) => ({
      method,
      amount,
    }));
  }

  private groupSalesByCashier(sales: any[]) {
    const cashierTotals: Record<string, { name: string; sales: number; amount: number }> = {};

    sales.forEach((sale) => {
      const cashierId = sale.cashierId;
      if (!cashierTotals[cashierId]) {
        cashierTotals[cashierId] = {
          name: sale.cashier.email,
          sales: 0,
          amount: 0,
        };
      }
      cashierTotals[cashierId].sales += 1;
      cashierTotals[cashierId].amount += parseFloat(sale.total.toFixed(2));
    });

    return Object.values(cashierTotals);
  }
}
