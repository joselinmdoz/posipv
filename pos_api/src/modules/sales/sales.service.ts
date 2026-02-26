import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CashSessionStatus, CurrencyCode, Prisma, StockMovementType } from "@prisma/client";
import { dec, moneyEq } from "../../common/decimal";
import { SettingsService } from "../settings/settings.service";

@Injectable()
export class SalesService {
  constructor(
    private prisma: PrismaService,
    private settingsService: SettingsService,
  ) {}

  async listSessionProducts(cashSessionId: string) {
    const session = await this.prisma.cashSession.findUnique({
      where: { id: cashSessionId },
      include: {
        register: {
          include: {
            warehouse: true,
          },
        },
      },
    });

    if (!session) throw new NotFoundException("Sesión de caja no existe.");
    if (session.status !== CashSessionStatus.OPEN) throw new BadRequestException("La sesión no está abierta.");
    if (!session.register.warehouse?.id) {
      throw new BadRequestException("El TPV no tiene almacén asociado.");
    }

    const stock = await this.prisma.stock.findMany({
      where: {
        warehouseId: session.register.warehouse.id,
        qty: { gt: 0 },
        product: { active: true },
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

    if (!dto.items?.length) throw new BadRequestException("Sin items.");
    if (!dto.payments?.length) throw new BadRequestException("Sin pagos.");

    const rateSnapshot = await this.settingsService.getCurrentUsdToCupRateSnapshot();

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
      const rawAmountOriginal = rawPayment.amountOriginal ?? rawPayment.amount;
      const amountOriginal = this.parsePositiveAmount(rawAmountOriginal, "Monto de pago inválido.");

      let amountBase = amountOriginal;
      const exchangeRateUsdToCup: Prisma.Decimal = dec(rateSnapshot.rate.toString());

      if (currency === CurrencyCode.USD) {
        amountBase = dec(amountOriginal.mul(exchangeRateUsdToCup).toFixed(2));
      }

      return {
        method: rawPayment.method,
        currency,
        amountOriginal,
        amount: amountBase,
        exchangeRateUsdToCup,
        exchangeRateRecordId: rateSnapshot.rateRecordId,
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
          total: total as any,
          items: { create: itemsData },
          payments: {
            create: normalizedPayments.map((p) => ({
              method: p.method,
              amount: dec(p.amount) as any,
              currency: p.currency,
              amountOriginal: dec(p.amountOriginal) as any,
              exchangeRateUsdToCup: dec(p.exchangeRateUsdToCup) as any,
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

  private normalizeCurrency(currencyInput?: string): CurrencyCode {
    const raw = (currencyInput || "CUP").toString().trim().toUpperCase();
    if (raw === CurrencyCode.CUP) return CurrencyCode.CUP;
    if (raw === CurrencyCode.USD) return CurrencyCode.USD;
    throw new BadRequestException("Moneda de pago inválida.");
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
}
