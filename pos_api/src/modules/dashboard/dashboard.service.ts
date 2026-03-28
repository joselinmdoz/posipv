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
      this.prisma.$queryRaw<Array<{ count: bigint | number }>>`
        SELECT COUNT(*)::bigint AS count
        FROM "Stock" s
        INNER JOIN "Product" p ON p."id" = s."productId"
        WHERE p."active" = true
          AND s."qty" <= COALESCE(p."lowStockAlertQty", 5)
      `,
    ]);

    const lowStockCount = Array.isArray(lowStock) && lowStock.length > 0 ? Number(lowStock[0].count || 0) : 0;

    return {
      salesToday: parseFloat((salesToday._sum.total || 0).toFixed(2)),
      transactionsToday,
      openSessions,
      lowStock: lowStockCount,
      lastSaleAt: lastSale?.createdAt.toISOString(),
    };
  }
}
