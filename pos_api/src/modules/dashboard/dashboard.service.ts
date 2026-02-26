import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getSummary() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [salesToday, transactionsToday, openSessions, lastSale, lowStock] = await Promise.all([
      this.prisma.sale.aggregate({
        where: {
          createdAt: { gte: today },
          status: { not: "VOID" },
        },
        _sum: { total: true },
      }),
      this.prisma.sale.count({
        where: {
          createdAt: { gte: today },
          status: { not: "VOID" },
        },
      }),
      this.prisma.cashSession.count({
        where: { status: "OPEN" },
      }),
      this.prisma.sale.findFirst({
        where: { status: { not: "VOID" } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      this.prisma.stock.count({
        where: {
          qty: { lte: 5 },
        },
      }),
    ]);

    return {
      salesToday: parseFloat((salesToday._sum.total || 0).toFixed(2)),
      transactionsToday,
      openSessions,
      lowStock,
      lastSaleAt: lastSale?.createdAt.toISOString(),
    };
  }
}
