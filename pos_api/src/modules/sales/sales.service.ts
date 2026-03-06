import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CashSessionStatus, CurrencyCode, Prisma, SaleChannel, SaleStatus, StockMovementType } from "@prisma/client";
import { dec, moneyEq } from "../../common/decimal";

@Injectable()
export class SalesService {
  constructor(private prisma: PrismaService) {}

  async listSessionProducts(cashSessionId: string) {
    const session = await this.prisma.cashSession.findUnique({
      where: { id: cashSessionId },
      include: {
        register: {
          include: {
            warehouse: true,
            settings: true,
          },
        },
      },
    });

    if (!session) throw new NotFoundException("Sesión de caja no existe.");
    if (session.status !== CashSessionStatus.OPEN) throw new BadRequestException("La sesión no está abierta.");
    if (!session.register.warehouse?.id) {
      throw new BadRequestException("El TPV no tiene almacén asociado.");
    }
    const registerCurrency = this.resolveRegisterCurrency(session.register.settings?.currency);

    const stock = await this.prisma.stock.findMany({
      where: {
        warehouseId: session.register.warehouse.id,
        qty: { gt: 0 },
        product: {
          active: true,
          currency: registerCurrency,
        },
      },
      include: {
        product: {
          include: {
            productType: true,
            productCategory: true,
            measurementUnit: true,
          },
        },
      },
      orderBy: { product: { name: "asc" } },
    });

    return stock.map((item) => ({
      ...item.product,
      qtyAvailable: item.qty,
    }));
  }

  async createSale(cashierId: string, dto: any) {
    const session = await this.prisma.cashSession.findUnique({
      where: { id: dto.cashSessionId },
      include: {
        register: {
          include: {
            warehouse: true,
            settings: true,
          },
        },
      },
    });
    if (!session) throw new NotFoundException("Sesión de caja no existe.");
    if (session.status !== CashSessionStatus.OPEN) throw new BadRequestException("La sesión no está abierta.");
    if (!session.register.warehouse?.id) {
      throw new BadRequestException("El TPV no tiene almacén asociado.");
    }
    const tpvWarehouseId = session.register.warehouse.id;
    const registerCurrency = this.resolveRegisterCurrency(session.register.settings?.currency);

    if (!dto.items?.length) throw new BadRequestException("Sin items.");
    if (!dto.payments?.length) throw new BadRequestException("Sin pagos.");

    const qtyByProduct = new Map<string, number>();
    for (const item of dto.items) {
      const currentQty = qtyByProduct.get(item.productId) || 0;
      qtyByProduct.set(item.productId, currentQty + item.qty);
    }
    const productIds = Array.from(qtyByProduct.keys());

    const stockRows = await this.prisma.stock.findMany({
      where: {
        warehouseId: tpvWarehouseId,
        productId: { in: productIds },
        product: { active: true },
      },
      include: {
        product: true,
      },
    });

    if (stockRows.length !== productIds.length) {
      throw new BadRequestException("Hay productos inválidos, inactivos o sin stock en el TPV.");
    }
    if (stockRows.some((row) => row.product.currency !== registerCurrency)) {
      throw new BadRequestException(
        `El TPV está configurado en ${registerCurrency}. Solo puede vender productos en esa moneda.`
      );
    }

    const stockByProduct = new Map(stockRows.map((s) => [s.productId, s]));
    for (const [productId, requestedQty] of qtyByProduct.entries()) {
      const stock = stockByProduct.get(productId);
      if (!stock || stock.qty < requestedQty) {
        throw new BadRequestException("Stock insuficiente para completar la venta.");
      }
    }

    const priceMap = new Map(stockRows.map((s) => [s.productId, s.product.price]));

    let total = new Prisma.Decimal(0);

    const itemsData = dto.items.map((i: any) => {
      const price = priceMap.get(i.productId);
      if (!price) throw new BadRequestException("Producto inválido.");
      total = total.add(price.mul(i.qty));
      return { productId: i.productId, qty: i.qty, price: price as any };
    });

    const normalizedPayments = dto.payments.map((rawPayment: any) => {
      const currency = this.normalizeCurrency(rawPayment.currency);
      if (currency !== registerCurrency) {
        throw new BadRequestException(
          `El TPV está configurado en ${registerCurrency}. Todos los pagos deben registrarse en esa moneda.`
        );
      }
      const rawAmountOriginal = rawPayment.amountOriginal ?? rawPayment.amount;
      const amountOriginal = this.parsePositiveAmount(rawAmountOriginal, "Monto de pago inválido.");

      return {
        method: rawPayment.method,
        currency,
        amountOriginal,
        amount: amountOriginal,
        exchangeRateUsdToCup: null,
        exchangeRateRecordId: null,
      };
    });

    const paySum = normalizedPayments.reduce((acc: Prisma.Decimal, p) => acc.add(dec(p.amount)), new Prisma.Decimal(0));

    // comparación exacta a 2 decimales
    if (!moneyEq(total, paySum)) {
      throw new BadRequestException(`Pagos (${paySum.toFixed(2)}) no cuadran con total (${total.toFixed(2)}).`);
    }

    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.create({
        data: {
          cashierId,
          cashSessionId: session.id,
          warehouseId: tpvWarehouseId,
          channel: SaleChannel.TPV,
          documentNumber: await this.generateDocumentNumber(tx, SaleChannel.TPV),
          total: total as any,
          items: { create: itemsData },
          payments: {
            create: normalizedPayments.map((p) => ({
              method: p.method,
              amount: dec(p.amount) as any,
              currency: p.currency,
              amountOriginal: dec(p.amountOriginal) as any,
              exchangeRateUsdToCup: null,
              exchangeRateRecordId: p.exchangeRateRecordId || null,
            })),
          },
        },
        include: { items: true, payments: true },
      });

      for (const [productId, requestedQty] of qtyByProduct.entries()) {
        const updated = await tx.stock.updateMany({
          where: {
            warehouseId: tpvWarehouseId,
            productId,
            qty: { gte: requestedQty },
          },
          data: {
            qty: { decrement: requestedQty },
          },
        });

        if (updated.count === 0) {
          throw new BadRequestException("Stock insuficiente al confirmar la venta.");
        }

        await tx.stockMovement.create({
          data: {
            type: StockMovementType.OUT,
            productId,
            qty: requestedQty,
            fromWarehouseId: tpvWarehouseId,
            reason: "VENTA",
          },
        });
      }

      return sale;
    });
  }

  async deleteSale(saleId: string, deletedByUserId: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        items: true,
        payments: true,
      },
    });
    if (!sale) throw new NotFoundException("Venta no encontrada.");

    return this.prisma.$transaction(async (tx) => {
      let restockedQty = 0;
      let restockedProducts = 0;

      if (sale.status === SaleStatus.PAID) {
        if (!sale.warehouseId) {
          throw new BadRequestException("La venta no tiene almacén asociado para revertir stock.");
        }

        const qtyByProduct = new Map<string, number>();
        for (const item of sale.items) {
          qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) || 0) + Number(item.qty));
        }

        for (const [productId, qty] of qtyByProduct.entries()) {
          await tx.stock.upsert({
            where: {
              warehouseId_productId: {
                warehouseId: sale.warehouseId,
                productId,
              },
            },
            create: {
              warehouseId: sale.warehouseId,
              productId,
              qty,
            },
            update: {
              qty: { increment: qty },
            },
          });

          await tx.stockMovement.create({
            data: {
              type: StockMovementType.IN,
              productId,
              qty,
              toWarehouseId: sale.warehouseId,
              reason: `ELIMINACION_VENTA:${sale.documentNumber || sale.id}:${deletedByUserId}`,
            },
          });

          restockedQty += qty;
          restockedProducts += 1;
        }
      }

      await tx.payment.deleteMany({ where: { saleId: sale.id } });
      await tx.saleItem.deleteMany({ where: { saleId: sale.id } });
      await tx.sale.delete({ where: { id: sale.id } });

      return {
        ok: true,
        deletedSaleId: sale.id,
        restockedProducts,
        restockedQty,
      };
    });
  }

  private normalizeCurrency(currencyInput?: string): CurrencyCode {
    const raw = (currencyInput || "CUP").toString().trim().toUpperCase();
    if (raw === CurrencyCode.CUP) return CurrencyCode.CUP;
    if (raw === CurrencyCode.USD) return CurrencyCode.USD;
    throw new BadRequestException("Moneda de pago inválida.");
  }

  private resolveRegisterCurrency(currencyInput?: string | null): CurrencyCode {
    const raw = (currencyInput || "CUP").toString().trim().toUpperCase();
    if (raw === CurrencyCode.CUP) return CurrencyCode.CUP;
    if (raw === CurrencyCode.USD) return CurrencyCode.USD;
    return CurrencyCode.CUP;
  }

  private parsePositiveAmount(input: string, message: string): Prisma.Decimal {
    try {
      const value = dec(input);
      if (!value.isFinite() || value.lte(0)) {
        throw new BadRequestException(message);
      }
      return value;
    } catch {
      throw new BadRequestException(message);
    }
  }

  private async generateDocumentNumber(tx: Prisma.TransactionClient, channel: SaleChannel) {
    const prefix = channel === SaleChannel.TPV ? "TPV" : "DIR";

    for (let attempt = 0; attempt < 5; attempt++) {
      const now = new Date();
      const stamp = [
        now.getFullYear(),
        `${now.getMonth() + 1}`.padStart(2, "0"),
        `${now.getDate()}`.padStart(2, "0"),
        `${now.getHours()}`.padStart(2, "0"),
        `${now.getMinutes()}`.padStart(2, "0"),
        `${now.getSeconds()}`.padStart(2, "0"),
      ].join("");
      const suffix = Math.floor(Math.random() * 900 + 100).toString();
      const candidate = `${prefix}-${stamp}-${suffix}`;

      const existing = await tx.sale.findUnique({
        where: { documentNumber: candidate },
        select: { id: true },
      });

      if (!existing) return candidate;
    }

    throw new BadRequestException("No se pudo generar un número de comprobante único.");
  }
}
