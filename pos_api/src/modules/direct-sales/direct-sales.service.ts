import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CurrencyCode, Prisma, SaleChannel, StockMovementType, WarehouseType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { dec, moneyEq } from "../../common/decimal";
import { SettingsService } from "../settings/settings.service";

@Injectable()
export class DirectSalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  async listWarehouseProducts(warehouseId: string) {
    const warehouse = await this.requireDirectWarehouse(warehouseId);

    const stock = await this.prisma.stock.findMany({
      where: {
        warehouseId: warehouse.id,
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

  async createDirectSale(cashierId: string, dto: any) {
    const warehouse = await this.requireDirectWarehouse(dto.warehouseId);
    const customer = await this.resolveCustomer(dto.customerId, dto.customerName);

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
        warehouseId: warehouse.id,
        productId: { in: productIds },
        product: { active: true },
      },
      include: {
        product: true,
      },
    });

    if (stockRows.length !== productIds.length) {
      throw new BadRequestException("Hay productos inválidos, inactivos o sin stock en el almacén.");
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

    if (!moneyEq(total, paySum)) {
      throw new BadRequestException(`Pagos (${paySum.toFixed(2)}) no cuadran con total (${total.toFixed(2)}).`);
    }

    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.create({
        data: {
          cashierId,
          warehouseId: warehouse.id,
          channel: SaleChannel.DIRECT,
          customerId: customer?.id || null,
          customerName: customer?.name || null,
          documentNumber: await this.generateDocumentNumber(tx, SaleChannel.DIRECT),
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
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  codigo: true,
                },
              },
            },
          },
          customer: {
            select: {
              id: true,
              name: true,
              identification: true,
            },
          },
          payments: true,
          warehouse: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      });

      for (const [productId, requestedQty] of qtyByProduct.entries()) {
        const updated = await tx.stock.updateMany({
          where: {
            warehouseId: warehouse.id,
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
            fromWarehouseId: warehouse.id,
            reason: "VENTA_DIRECTA",
          },
        });
      }

      return sale;
    });
  }

  async getTicket(saleId: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
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
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            identification: true,
          },
        },
      },
    });

    if (!sale) throw new NotFoundException("Venta no encontrada.");
    if (sale.channel !== SaleChannel.DIRECT) {
      throw new BadRequestException("El comprobante solicitado no corresponde a una venta directa.");
    }

    const paymentTotal = sale.payments.reduce((sum, p) => sum.add(p.amount), dec(0));

    return {
      saleId: sale.id,
      documentNumber: sale.documentNumber,
      createdAt: sale.createdAt,
      customerName: sale.customerName,
      customer: sale.customer,
      cashier: sale.cashier,
      warehouse: sale.warehouse,
      totals: {
        total: Number(sale.total.toFixed(2)),
        paymentTotal: Number(paymentTotal.toFixed(2)),
      },
      items: sale.items.map((item) => ({
        productId: item.productId,
        name: item.product.name,
        codigo: item.product.codigo,
        barcode: item.product.barcode,
        qty: item.qty,
        price: Number(item.price.toFixed(2)),
        subtotal: Number(item.price.mul(item.qty).toFixed(2)),
      })),
      payments: sale.payments.map((payment) => ({
        method: payment.method,
        amount: Number(payment.amount.toFixed(2)),
        amountOriginal: Number(payment.amountOriginal.toFixed(2)),
        currency: payment.currency,
        exchangeRateUsdToCup: payment.exchangeRateUsdToCup ? Number(payment.exchangeRateUsdToCup.toFixed(6)) : null,
      })),
    };
  }

  private async requireDirectWarehouse(warehouseId: string) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse || !warehouse.active) {
      throw new NotFoundException("Almacén no encontrado o inactivo.");
    }

    if (warehouse.type === WarehouseType.TPV) {
      throw new BadRequestException("Para ventas directas debe seleccionar un almacén no-TPV.");
    }

    return warehouse;
  }

  private normalizeCustomerName(input?: string): string | null {
    const value = (input || "").trim();
    return value.length ? value : null;
  }

  private async resolveCustomer(customerId?: string, fallbackCustomerName?: string) {
    const normalizedCustomerId = (customerId || "").trim();
    if (normalizedCustomerId.length) {
      const customer = await this.prisma.client.findUnique({
        where: { id: normalizedCustomerId },
        select: {
          id: true,
          name: true,
          active: true,
        },
      });
      if (!customer || !customer.active) {
        throw new BadRequestException("El cliente seleccionado no existe o está inactivo.");
      }
      return customer;
    }

    const fallbackName = this.normalizeCustomerName(fallbackCustomerName);
    if (!fallbackName) return null;

    // Compatibilidad temporal para clientes en texto libre.
    return {
      id: null,
      name: fallbackName,
      active: true,
    };
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
