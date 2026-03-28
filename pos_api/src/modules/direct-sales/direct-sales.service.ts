import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CurrencyCode, PaymentMethod, Prisma, SaleChannel, StockMovementType, WarehouseType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { dec, moneyEq } from "../../common/decimal";
import { SettingsService } from "../settings/settings.service";
import { AccountingService } from "../accounting/accounting.service";

@Injectable()
export class DirectSalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
    private readonly accountingService: AccountingService,
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
      qtyAvailable: Number(item.qty),
    }));
  }

  async createDirectSale(cashierId: string, dto: any) {
    const warehouse = await this.requireDirectWarehouse(dto.warehouseId);
    const customer = await this.resolveCustomer(dto.customerId, dto.customerName);

    if (!dto.items?.length) throw new BadRequestException("Sin items.");
    if (!dto.payments?.length) throw new BadRequestException("Sin pagos.");

    const rateSnapshot = await this.settingsService.getCurrentUsdToCupRateSnapshot();
    const paymentMethodRules = await this.resolvePaymentMethodRulesForDirectSale();

    const normalizedItems = dto.items.map((item: any) => ({
      productId: item.productId,
      qty: this.parsePositiveQty(item.qty),
    }));

    const qtyByProduct = new Map<string, number>();
    for (const item of normalizedItems) {
      const currentQty = qtyByProduct.get(item.productId) || 0;
      qtyByProduct.set(item.productId, Number((currentQty + item.qty).toFixed(6)));
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
    const productById = new Map(stockRows.map((s) => [s.productId, s.product]));

    for (const item of normalizedItems) {
      const product = productById.get(item.productId);
      if (!product) {
        throw new BadRequestException("Producto inválido.");
      }
      if (!product.allowFractionalQty && !Number.isInteger(item.qty)) {
        throw new BadRequestException(`El producto "${product.name}" no permite cantidades fraccionadas.`);
      }
    }

    for (const [productId, requestedQty] of qtyByProduct.entries()) {
      const stock = stockByProduct.get(productId);
      if (!stock || Number(stock.qty) < requestedQty) {
        throw new BadRequestException("Stock insuficiente para completar la venta.");
      }
    }

    const exchangeRateUsdToCup: Prisma.Decimal = dec(rateSnapshot.rate.toString());
    let total = new Prisma.Decimal(0);

    const itemsData = normalizedItems.map((i: any) => {
      const product = productById.get(i.productId);
      if (!product) throw new BadRequestException("Producto inválido.");

      const linePrice = dec(product.price);
      const lineTotal = linePrice.mul(i.qty);
      const lineTotalBaseCup =
        product.currency === CurrencyCode.USD
          ? dec(lineTotal.mul(exchangeRateUsdToCup).toFixed(2))
          : dec(lineTotal.toFixed(2));

      total = total.add(lineTotalBaseCup);
      return {
        productId: i.productId,
        qty: i.qty,
        price: linePrice as any,
        costSnapshot: product.cost ?? null,
      };
    });

    const normalizedPayments = dto.payments.map((rawPayment: any) => {
      const method = this.normalizePaymentMethod(rawPayment.method);
      const methodRule = paymentMethodRules.get(method);
      if (!methodRule || methodRule.enabled !== true) {
        throw new BadRequestException(`El método de pago ${method} no está habilitado.`);
      }

      const transactionCode = this.normalizeTransactionCode(rawPayment.transactionCode);
      if (methodRule.requiresTransactionCode && !transactionCode) {
        throw new BadRequestException(`El método ${method} requiere código de transacción.`);
      }

      const currency = this.normalizeCurrency(rawPayment.currency);
      const rawAmountOriginal = rawPayment.amountOriginal ?? rawPayment.amount;
      const amountOriginal = this.parsePositiveAmount(rawAmountOriginal, "Monto de pago inválido.");

      let amountBase = amountOriginal;

      if (currency === CurrencyCode.USD) {
        amountBase = dec(amountOriginal.mul(exchangeRateUsdToCup).toFixed(2));
      }

      return {
        method,
        currency,
        amountOriginal,
        amount: amountBase,
        transactionCode,
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
              transactionCode: p.transactionCode || null,
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

      await this.accountingService.postAutomatedSaleEntries(tx, sale.id, cashierId);

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
                currency: true,
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
        currency: item.product.currency,
        qty: item.qty,
        price: Number(item.price.toFixed(2)),
        subtotal: Number(item.price.mul(item.qty).toFixed(2)),
      })),
      payments: sale.payments.map((payment) => ({
        method: payment.method,
        amount: Number(payment.amount.toFixed(2)),
        amountOriginal: Number(payment.amountOriginal.toFixed(2)),
        transactionCode: payment.transactionCode || null,
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

  private normalizePaymentMethod(methodInput: unknown): PaymentMethod {
    const raw = String(methodInput || "").trim().toUpperCase();
    switch (raw) {
      case PaymentMethod.CASH:
      case PaymentMethod.CARD:
      case PaymentMethod.TRANSFER:
      case PaymentMethod.OTHER:
        return raw as PaymentMethod;
      default:
        throw new BadRequestException("Método de pago inválido.");
    }
  }

  private normalizePaymentMethodCode(codeInput: unknown): PaymentMethod | null {
    const raw = String(codeInput || "").trim().toUpperCase();
    switch (raw) {
      case "CASH":
      case "EFECTIVO":
        return PaymentMethod.CASH;
      case "CARD":
      case "TARJETA":
        return PaymentMethod.CARD;
      case "TRANSFER":
      case "TRANSFERENCIA":
        return PaymentMethod.TRANSFER;
      case "OTHER":
      case "OTRO":
        return PaymentMethod.OTHER;
      default:
        return null;
    }
  }

  private normalizeTransactionCode(value: unknown): string | null {
    const normalized = String(value || "").trim();
    if (!normalized) return null;
    return normalized.slice(0, 120);
  }

  private async resolvePaymentMethodRulesForDirectSale(): Promise<Map<PaymentMethod, { enabled: boolean; requiresTransactionCode: boolean }>> {
    const methods = await this.prisma.paymentMethodSetting.findMany({
      where: { enabled: true },
      select: {
        code: true,
        enabled: true,
        requiresTransactionCode: true,
      },
    });

    const map = new Map<PaymentMethod, { enabled: boolean; requiresTransactionCode: boolean }>();
    for (const row of methods || []) {
      if (row.enabled === false) continue;
      const method = this.normalizePaymentMethodCode(row.code);
      if (!method) continue;
      map.set(method, {
        enabled: true,
        requiresTransactionCode: row.requiresTransactionCode === true,
      });
    }

    if (map.size > 0) return map;

    return new Map<PaymentMethod, { enabled: boolean; requiresTransactionCode: boolean }>([
      [PaymentMethod.CASH, { enabled: true, requiresTransactionCode: false }],
      [PaymentMethod.CARD, { enabled: true, requiresTransactionCode: false }],
      [PaymentMethod.TRANSFER, { enabled: true, requiresTransactionCode: false }],
      [PaymentMethod.OTHER, { enabled: false, requiresTransactionCode: false }],
    ]);
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

  private parsePositiveQty(input: unknown): number {
    const value = Number(input);
    if (!Number.isFinite(value) || value <= 0) {
      throw new BadRequestException("Cantidad inválida. Debe ser mayor a 0.");
    }
    return Number(value.toFixed(6));
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
