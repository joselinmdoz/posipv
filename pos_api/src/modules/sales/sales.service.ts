import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CashSessionStatus } from "@prisma/client";
import { dec, moneyEq } from "../../common/decimal";
import { Prisma } from "@prisma/client";

@Injectable()
export class SalesService {
  constructor(private prisma: PrismaService) {}

  async createSale(cashierId: string, dto: any) {
    const session = await this.prisma.cashSession.findUnique({
      where: { id: dto.cashSessionId },
      include: { register: true },
    });
    if (!session) throw new NotFoundException("Sesión de caja no existe.");
    if (session.status !== CashSessionStatus.OPEN) throw new BadRequestException("La sesión no está abierta.");

    if (!dto.items?.length) throw new BadRequestException("Sin items.");
    if (!dto.payments?.length) throw new BadRequestException("Sin pagos.");

    const productIds = dto.items.map((i: any) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, active: true },
    });

    if (products.length !== productIds.length) throw new BadRequestException("Producto inválido o inactivo.");

    const priceMap = new Map(products.map((p) => [p.id, p.price]));

    let total = new Prisma.Decimal(0);

    const itemsData = dto.items.map((i: any) => {
      const price = priceMap.get(i.productId);
      if (!price) throw new BadRequestException("Producto inválido.");
      total = total.add(price.mul(i.qty));
      return { productId: i.productId, qty: i.qty, price: price as any };
    });

    const paySum = dto.payments.reduce((acc: Prisma.Decimal, p: any) => acc.add(dec(p.amount)), new Prisma.Decimal(0));

    // comparación exacta a 2 decimales
    if (!moneyEq(total, paySum)) {
      throw new BadRequestException(`Pagos (${paySum.toFixed(2)}) no cuadran con total (${total.toFixed(2)}).`);
    }

    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.create({
        data: {
          cashierId,
          cashSessionId: session.id,
          total: total as any,
          items: { create: itemsData },
          payments: {
            create: dto.payments.map((p: any) => ({
              method: p.method,
              amount: dec(p.amount) as any,
            })),
          },
        },
        include: { items: true, payments: true },
      });

      return sale;
    });
  }
}
