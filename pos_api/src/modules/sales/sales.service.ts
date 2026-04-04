import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CashSessionStatus, CurrencyCode, PaymentMethod, Prisma, SaleChannel, SaleStatus, StockMovementType } from "@prisma/client";
import { dec, moneyEq } from "../../common/decimal";
import { AccountingService } from "../accounting/accounting.service";
import { InventoryCostingService } from "../inventory-costing/inventory-costing.service";

@Injectable()
export class SalesService {
  constructor(
    private prisma: PrismaService,
    private accountingService: AccountingService,
    private inventoryCostingService: InventoryCostingService,
  ) {}

  async listSessionProducts(cashSessionId: string) {
    const session = await this.prisma.cashSession.findUnique({
      where: { id: cashSessionId },
      include: {
        register: {
          include: {
            warehouse: true,
            settings: {
              include: {
                paymentMethods: true,
              },
            },
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
      qtyAvailable: Number(item.qty),
    }));
  }

  async createSale(cashierId: string, dto: any) {
    const session = await this.prisma.cashSession.findUnique({
      where: { id: dto.cashSessionId },
      include: {
        register: {
          include: {
            warehouse: true,
            settings: {
              include: {
                paymentMethods: true,
              },
            },
          },
        },
      },
    });
    if (!session) throw new NotFoundException("Sesión de caja no existe.");
    if (session.status !== CashSessionStatus.OPEN) throw new BadRequestException("La sesión no está abierta.");
    if (!session.register.warehouse?.id) {
      throw new BadRequestException("El TPV no tiene almacén asociado.");
    }
    const customer = await this.resolveCustomer(dto.customerId, dto.customerName);
    const tpvWarehouseId = session.register.warehouse.id;
    const registerCurrency = this.resolveRegisterCurrency(session.register.settings?.currency);
    const paymentMethodRules = await this.resolvePaymentMethodRulesForSale(session.register.settings?.paymentMethods || []);
    await this.assertCashierAllowedForRegister(session.registerId, cashierId, session.register.settings?.sellerEmployeeIds || []);

    if (!dto.items?.length) throw new BadRequestException("Sin items.");
    if (!dto.payments?.length) throw new BadRequestException("Sin pagos.");

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

    const priceMap = new Map(stockRows.map((s) => [s.productId, s.product.price]));
    const fallbackCostByProduct = new Map(stockRows.map((s) => [s.productId, s.product.cost || 0]));

    let total = new Prisma.Decimal(0);

    const itemsData = normalizedItems.map((i: any) => {
      const price = priceMap.get(i.productId);
      const product = productById.get(i.productId);
      if (!price || !product) throw new BadRequestException("Producto inválido.");
      total = total.add(price.mul(i.qty));
      return {
        productId: i.productId,
        qty: i.qty,
        price: price as any,
        costSnapshot: null,
      };
    });

    const normalizedPayments = dto.payments.map((rawPayment: any) => {
      const method = this.normalizePaymentMethod(rawPayment.method);
      const methodRule = paymentMethodRules.get(method);
      if (!methodRule || methodRule.enabled !== true) {
        throw new BadRequestException(`El método de pago ${method} no está habilitado para este TPV.`);
      }

      const transactionCode = this.normalizeTransactionCode(rawPayment.transactionCode);
      if (methodRule.requiresTransactionCode && !transactionCode) {
        throw new BadRequestException(`El método ${method} requiere código de transacción.`);
      }

      const currency = this.normalizeCurrency(rawPayment.currency);
      if (currency !== registerCurrency) {
        throw new BadRequestException(
          `El TPV está configurado en ${registerCurrency}. Todos los pagos deben registrarse en esa moneda.`
        );
      }
      const rawAmountOriginal = rawPayment.amountOriginal ?? rawPayment.amount;
      const amountOriginal = this.parsePositiveAmount(rawAmountOriginal, "Monto de pago inválido.");

      return {
        method,
        currency,
        amountOriginal,
        amount: amountOriginal,
        transactionCode,
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
          customerId: customer?.id || null,
          customerName: customer?.name || null,
          documentNumber: await this.generateDocumentNumber(tx, SaleChannel.TPV),
          total: total as any,
          items: { create: itemsData },
          payments: {
            create: normalizedPayments.map((p) => ({
              method: p.method,
              amount: dec(p.amount) as any,
              currency: p.currency,
              amountOriginal: dec(p.amountOriginal) as any,
              transactionCode: p.transactionCode || null,
              exchangeRateUsdToCup: null,
              exchangeRateRecordId: p.exchangeRateRecordId || null,
            })),
          },
        },
        include: { items: true, payments: true },
      });

      const averageCostByItem = await this.inventoryCostingService.consumeSaleItemsWithFifo(
        tx,
        sale.items.map((item) => ({
          saleId: sale.id,
          saleItemId: item.id,
          warehouseId: tpvWarehouseId,
          productId: item.productId,
          qty: item.qty,
          unitPrice: item.price,
          fallbackUnitCost: fallbackCostByProduct.get(item.productId) || 0,
        })),
      );

      for (const item of sale.items) {
        const averageCost = averageCostByItem.get(item.id);
        await tx.saleItem.update({
          where: { id: item.id },
          data: {
            costSnapshot: averageCost ? dec(averageCost.toFixed(2)) : null,
          },
        });
      }

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

      await this.accountingService.postAutomatedSaleEntries(tx, sale.id, cashierId);

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
        await this.inventoryCostingService.restoreSaleLots(tx, sale.id);

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

      await this.accountingService.voidAutomatedSaleEntries(
        tx,
        sale.id,
        `ELIMINACION_VENTA:${sale.documentNumber || sale.id}:${deletedByUserId}`,
      );

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

  private async resolvePaymentMethodRulesForSale(
    registerPaymentMethods: Array<{ code: string; enabled: boolean; requiresTransactionCode?: boolean }>
  ): Promise<Map<PaymentMethod, { enabled: boolean; requiresTransactionCode: boolean }>> {
    const fromRegister = this.buildPaymentMethodRules(registerPaymentMethods);
    if (fromRegister.size > 0) return fromRegister;

    const globalMethods = await this.prisma.paymentMethodSetting.findMany({
      where: { enabled: true },
      select: {
        code: true,
        enabled: true,
        requiresTransactionCode: true,
      },
    });
    const fromGlobal = this.buildPaymentMethodRules(globalMethods);
    if (fromGlobal.size > 0) return fromGlobal;

    return new Map<PaymentMethod, { enabled: boolean; requiresTransactionCode: boolean }>([
      [PaymentMethod.CASH, { enabled: true, requiresTransactionCode: false }],
      [PaymentMethod.CARD, { enabled: true, requiresTransactionCode: false }],
      [PaymentMethod.TRANSFER, { enabled: true, requiresTransactionCode: false }],
      [PaymentMethod.OTHER, { enabled: false, requiresTransactionCode: false }],
    ]);
  }

  private buildPaymentMethodRules(
    rows: Array<{ code: string; enabled: boolean; requiresTransactionCode?: boolean }>
  ): Map<PaymentMethod, { enabled: boolean; requiresTransactionCode: boolean }> {
    const map = new Map<PaymentMethod, { enabled: boolean; requiresTransactionCode: boolean }>();
    for (const row of rows || []) {
      if (row.enabled === false) continue;
      const method = this.normalizePaymentMethodCode(row.code);
      if (!method) continue;
      map.set(method, {
        enabled: true,
        requiresTransactionCode: row.requiresTransactionCode === true,
      });
    }
    return map;
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

    return {
      id: null,
      name: fallbackName,
      active: true,
    };
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

  private async assertCashierAllowedForRegister(registerId: string, userId: string, configuredEmployeeIds: string[]) {
    const allowedEmployeeIds = Array.isArray(configuredEmployeeIds) ? configuredEmployeeIds : [];
    if (allowedEmployeeIds.length === 0) {
      return;
    }

    const employee = await this.prisma.employee.findFirst({
      where: {
        userId,
        active: true,
      },
      select: {
        id: true,
      },
    });

    if (!employee || !allowedEmployeeIds.includes(employee.id)) {
      throw new BadRequestException("Este cajero no está autorizado para vender en el TPV seleccionado.");
    }
  }
}
