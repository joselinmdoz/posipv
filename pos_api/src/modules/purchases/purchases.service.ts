import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CurrencyCode, Prisma, PurchaseStatus, StockMovementType } from "@prisma/client";
import { dec } from "../../common/decimal";
import { PrismaService } from "../../prisma/prisma.service";

type PurchaseItemInput = {
  productId: string;
  qty: number;
  cost: number;
};

type CreatePurchaseInput = {
  warehouseId: string;
  supplierName?: string;
  supplierDocument?: string;
  documentNumber?: string;
  note?: string;
  currency?: CurrencyCode;
  status?: PurchaseStatus;
  items: PurchaseItemInput[];
};

type UpdatePurchaseInput = {
  warehouseId?: string;
  supplierName?: string;
  supplierDocument?: string;
  documentNumber?: string;
  note?: string;
  currency?: CurrencyCode;
  items?: PurchaseItemInput[];
};

type ListPurchasesInput = {
  q?: string;
  warehouseId?: string;
  status?: PurchaseStatus;
  from?: string;
  to?: string;
  limit?: string;
};

@Injectable()
export class PurchasesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(input: ListPurchasesInput) {
    const q = this.normalize(input.q);
    const fromDate = this.parseOptionalDate(input.from, "from");
    const toDate = this.parseOptionalDate(input.to, "to");
    const limit = this.parseLimit(input.limit, 300);

    if (fromDate && toDate && fromDate > toDate) {
      throw new BadRequestException("Rango de fechas inválido.");
    }

    try {
      return await this.prisma.purchase.findMany({
        where: {
          ...(input.warehouseId ? { warehouseId: input.warehouseId } : {}),
          ...(input.status ? { status: input.status } : {}),
          ...(fromDate || toDate
            ? {
                createdAt: {
                  ...(fromDate ? { gte: fromDate } : {}),
                  ...(toDate ? { lte: toDate } : {}),
                },
              }
            : {}),
          ...(q
            ? {
                OR: [
                  { supplierName: { contains: q, mode: "insensitive" } },
                  { supplierDocument: { contains: q, mode: "insensitive" } },
                  { documentNumber: { contains: q, mode: "insensitive" } },
                  { note: { contains: q, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: "desc" }],
        take: limit,
        include: {
          warehouse: { select: { id: true, name: true, code: true } },
          createdBy: { select: { id: true, email: true } },
        },
      });
    } catch (error) {
      this.handlePrismaStorageError(error);
    }
  }

  async findOne(purchaseId: string) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        warehouse: { select: { id: true, name: true, code: true, type: true } },
        createdBy: { select: { id: true, email: true, role: true } },
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
      },
    });
    if (!purchase) throw new NotFoundException("Compra no encontrada.");
    return purchase;
  }

  async create(userId: string, input: CreatePurchaseInput) {
    const warehouse = await this.requireWarehouse(input.warehouseId);
    const normalizedItems = await this.normalizePurchaseItems(input.items);
    const totals = this.computeTotals(normalizedItems);
    const status = this.normalizeInitialStatus(input.status);
    const documentNumber = await this.resolveDocumentNumber(input.documentNumber);

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.purchase.create({
        data: {
          warehouseId: warehouse.id,
          createdById: userId,
          supplierName: this.optionalText(input.supplierName, 120),
          supplierDocument: this.optionalText(input.supplierDocument, 80),
          documentNumber,
          note: this.optionalText(input.note, 600),
          currency: input.currency || CurrencyCode.CUP,
          subtotal: dec(totals.subtotal.toFixed(2)),
          total: dec(totals.total.toFixed(2)),
          status,
          confirmedAt: status === PurchaseStatus.CONFIRMED ? new Date() : null,
          items: {
            create: normalizedItems.map((item) => ({
              productId: item.productId,
              qty: item.qty,
              cost: dec(item.cost.toFixed(2)),
              total: dec(item.total.toFixed(2)),
            })),
          },
        },
        include: {
          items: true,
        },
      });

      if (created.status === PurchaseStatus.CONFIRMED) {
        await this.applyPurchaseStock(tx, created.id, created.warehouseId, created.items);
      }

      return this.findOneTx(tx, created.id);
    });
  }

  async update(purchaseId: string, input: UpdatePurchaseInput) {
    const purchase = await this.ensurePurchaseExists(purchaseId);
    if (purchase.status !== PurchaseStatus.DRAFT) {
      throw new BadRequestException("Solo se pueden editar compras en borrador.");
    }

    const warehouseId = input.warehouseId?.trim() || purchase.warehouseId;
    await this.requireWarehouse(warehouseId);
    const existingItems = await this.prisma.purchaseItem.findMany({
      where: { purchaseId },
      select: { productId: true, qty: true, cost: true, total: true },
    });

    const normalizedItems =
      input.items && input.items.length > 0
        ? await this.normalizePurchaseItems(input.items)
        : existingItems.map((row) => ({
            productId: row.productId,
            qty: Number(row.qty),
            cost: Number(row.cost),
            total: Number(row.total),
          }));

    const totals = this.computeTotals(normalizedItems);
    const documentNumber = this.normalize(input.documentNumber) ?? purchase.documentNumber ?? null;
    if (documentNumber && documentNumber !== purchase.documentNumber) {
      await this.ensureDocumentNumberAvailable(documentNumber);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.purchase.update({
        where: { id: purchaseId },
        data: {
          warehouseId,
          supplierName:
            input.supplierName !== undefined
              ? this.optionalText(input.supplierName, 120)
              : purchase.supplierName,
          supplierDocument:
            input.supplierDocument !== undefined
              ? this.optionalText(input.supplierDocument, 80)
              : purchase.supplierDocument,
          documentNumber,
          note: input.note !== undefined ? this.optionalText(input.note, 600) : purchase.note,
          currency: input.currency || purchase.currency,
          subtotal: dec(totals.subtotal.toFixed(2)),
          total: dec(totals.total.toFixed(2)),
        },
      });

      if (input.items) {
        await tx.purchaseItem.deleteMany({ where: { purchaseId } });
        await tx.purchaseItem.createMany({
          data: normalizedItems.map((item) => ({
            purchaseId,
            productId: item.productId,
            qty: item.qty,
            cost: dec(item.cost.toFixed(2)),
            total: dec(item.total.toFixed(2)),
          })),
        });
      }

      return this.findOneTx(tx, purchaseId);
    });
  }

  async confirm(purchaseId: string) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: { items: true },
    });
    if (!purchase) throw new NotFoundException("Compra no encontrada.");
    if (purchase.status === PurchaseStatus.VOID) {
      throw new BadRequestException("No se puede confirmar una compra anulada.");
    }
    if (purchase.status === PurchaseStatus.CONFIRMED) {
      return this.findOne(purchaseId);
    }

    return this.prisma.$transaction(async (tx) => {
      await this.applyPurchaseStock(tx, purchase.id, purchase.warehouseId, purchase.items);
      await tx.purchase.update({
        where: { id: purchase.id },
        data: {
          status: PurchaseStatus.CONFIRMED,
          confirmedAt: new Date(),
        },
      });
      return this.findOneTx(tx, purchase.id);
    });
  }

  async void(purchaseId: string, reason?: string) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: { items: true },
    });
    if (!purchase) throw new NotFoundException("Compra no encontrada.");
    if (purchase.status === PurchaseStatus.VOID) {
      return this.findOne(purchaseId);
    }

    return this.prisma.$transaction(async (tx) => {
      if (purchase.status === PurchaseStatus.CONFIRMED) {
        await this.revertPurchaseStock(tx, purchase.id, purchase.warehouseId, purchase.items);
      }

      const voidNote = this.buildVoidNote(purchase.note, reason);
      await tx.purchase.update({
        where: { id: purchase.id },
        data: {
          status: PurchaseStatus.VOID,
          voidedAt: new Date(),
          note: voidNote,
        },
      });

      return this.findOneTx(tx, purchase.id);
    });
  }

  async delete(purchaseId: string) {
    const purchase = await this.ensurePurchaseExists(purchaseId);
    if (purchase.status !== PurchaseStatus.DRAFT) {
      throw new BadRequestException("Solo se pueden eliminar compras en borrador.");
    }

    await this.prisma.purchase.delete({ where: { id: purchaseId } });
    return { ok: true, id: purchaseId };
  }

  private async normalizePurchaseItems(items: PurchaseItemInput[]) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException("La compra debe contener al menos un producto.");
    }

    const grouped = new Map<string, { qty: number; cost: number }>();
    for (const raw of items) {
      const productId = this.requiredText(raw.productId, "productId", 80);
      const qty = this.parsePositiveQty(raw.qty, "qty");
      const cost = this.parsePositiveNumber(raw.cost, "cost");

      const current = grouped.get(productId);
      if (!current) {
        grouped.set(productId, { qty, cost });
      } else {
        current.qty += qty;
        current.cost = cost;
      }
    }

    const productIds = Array.from(grouped.keys());
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        active: true,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException("Uno o más productos no existen o están inactivos.");
    }

    const productMap = new Map(products.map((p) => [p.id, p]));
    return productIds.map((productId) => {
      const product = productMap.get(productId);
      if (!product) throw new BadRequestException("Producto inválido en compra.");
      const groupedItem = grouped.get(productId)!;
      const total = dec(groupedItem.cost).mul(groupedItem.qty);
      return {
        productId,
        qty: groupedItem.qty,
        cost: Number(dec(groupedItem.cost).toFixed(2)),
        total: Number(total.toFixed(2)),
      };
    });
  }

  private computeTotals(items: Array<{ total: number }>) {
    let subtotal = dec(0);
    for (const item of items) {
      subtotal = subtotal.add(dec(item.total));
    }
    return {
      subtotal: Number(subtotal.toFixed(2)),
      total: Number(subtotal.toFixed(2)),
    };
  }

  private async applyPurchaseStock(
    tx: Prisma.TransactionClient,
    purchaseId: string,
    warehouseId: string,
    items: Array<{ productId: string; qty: number | Prisma.Decimal }>
  ) {
    for (const item of items) {
      const qty = Number(item.qty);
      const existing = await tx.stock.findUnique({
        where: {
          warehouseId_productId: {
            warehouseId,
            productId: item.productId,
          },
        },
      });

      if (existing) {
        await tx.stock.update({
          where: {
            warehouseId_productId: {
              warehouseId,
              productId: item.productId,
            },
          },
          data: {
            qty: { increment: qty },
          },
        });
      } else {
        await tx.stock.create({
          data: {
            warehouseId,
            productId: item.productId,
            qty,
          },
        });
      }

      await tx.stockMovement.create({
        data: {
          type: StockMovementType.IN,
          productId: item.productId,
          qty,
          toWarehouseId: warehouseId,
          reason: `COMPRA:${purchaseId}`,
        },
      });
    }
  }

  private async revertPurchaseStock(
    tx: Prisma.TransactionClient,
    purchaseId: string,
    warehouseId: string,
    items: Array<{ productId: string; qty: number | Prisma.Decimal }>
  ) {
    for (const item of items) {
      const qty = Number(item.qty);
      const stock = await tx.stock.findUnique({
        where: {
          warehouseId_productId: {
            warehouseId,
            productId: item.productId,
          },
        },
      });

      if (!stock || Number(stock.qty) < qty) {
        throw new BadRequestException(
          "No se puede anular la compra porque el stock actual es menor a la cantidad comprada.",
        );
      }

      await tx.stock.update({
        where: {
          warehouseId_productId: {
            warehouseId,
            productId: item.productId,
          },
        },
        data: {
          qty: { decrement: qty },
        },
      });

      await tx.stockMovement.create({
        data: {
          type: StockMovementType.OUT,
          productId: item.productId,
          qty,
          fromWarehouseId: warehouseId,
          reason: `ANULACION_COMPRA:${purchaseId}`,
        },
      });
    }
  }

  private async requireWarehouse(warehouseId: string) {
    const id = this.requiredText(warehouseId, "warehouseId", 80);
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
      select: { id: true, active: true },
    });
    if (!warehouse || !warehouse.active) {
      throw new NotFoundException("Almacén no encontrado o inactivo.");
    }
    return warehouse;
  }

  private normalizeInitialStatus(status?: PurchaseStatus): PurchaseStatus {
    if (!status) return PurchaseStatus.CONFIRMED;
    if (status === PurchaseStatus.DRAFT || status === PurchaseStatus.CONFIRMED) return status;
    throw new BadRequestException("Estado inicial de compra inválido.");
  }

  private async resolveDocumentNumber(input?: string) {
    const provided = this.normalize(input);
    if (provided) {
      await this.ensureDocumentNumberAvailable(provided);
      return provided;
    }
    return this.generateDocumentNumber();
  }

  private async ensureDocumentNumberAvailable(documentNumber: string) {
    const existing = await this.prisma.purchase.findUnique({
      where: { documentNumber },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException("El número de documento de compra ya existe.");
    }
  }

  private async generateDocumentNumber() {
    for (let attempt = 0; attempt < 8; attempt++) {
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
      const candidate = `PUR-${stamp}-${suffix}`;

      const existing = await this.prisma.purchase.findUnique({
        where: { documentNumber: candidate },
        select: { id: true },
      });
      if (!existing) return candidate;
    }
    throw new BadRequestException("No se pudo generar un número de compra único.");
  }

  private buildVoidNote(originalNote?: string | null, reason?: string) {
    const rawReason = this.normalize(reason);
    if (!rawReason) return originalNote || null;
    const prefix = `ANULADA: ${rawReason}`;
    if (!originalNote) return prefix;
    return `${originalNote}\n${prefix}`;
  }

  private async ensurePurchaseExists(purchaseId: string) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
    });
    if (!purchase) throw new NotFoundException("Compra no encontrada.");
    return purchase;
  }

  private async findOneTx(tx: Prisma.TransactionClient, purchaseId: string) {
    const purchase = await tx.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        warehouse: { select: { id: true, name: true, code: true, type: true } },
        createdBy: { select: { id: true, email: true, role: true } },
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
      },
    });
    if (!purchase) throw new NotFoundException("Compra no encontrada.");
    return purchase;
  }

  private parsePositiveNumber(value: number, fieldName: string) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new BadRequestException(`${fieldName} debe ser mayor a 0.`);
    }
    return parsed;
  }

  private parsePositiveQty(value: number, fieldName: string) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new BadRequestException(`${fieldName} debe ser mayor a 0.`);
    }
    return Number(parsed.toFixed(3));
  }

  private parseOptionalDate(value: string | undefined, fieldName: string) {
    if (!value) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split("-").map(Number);
      const date = new Date(y, m - 1, d, 0, 0, 0, 0);
      if (fieldName === "to") {
        date.setHours(23, 59, 59, 999);
      }
      return date;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Fecha ${fieldName} inválida.`);
    }
    return date;
  }

  private parseLimit(value: string | undefined, fallback: number) {
    if (!value) return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new BadRequestException("Parámetro limit inválido.");
    }
    return Math.min(1000, Math.floor(parsed));
  }

  private normalize(value?: string | null) {
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }

  private requiredText(value: string, fieldName: string, maxLength: number) {
    const normalized = this.normalize(value);
    if (!normalized) {
      throw new BadRequestException(`${fieldName} es requerido.`);
    }
    return normalized.slice(0, maxLength);
  }

  private optionalText(value: string | undefined, maxLength: number) {
    const normalized = this.normalize(value);
    return normalized ? normalized.slice(0, maxLength) : null;
  }

  private handlePrismaStorageError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2021" || error.code === "P2022") {
        throw new BadRequestException(
          "El módulo de compras no está listo en base de datos. Aplique las migraciones de Prisma y reinicie la API."
        );
      }
    }
    throw error;
  }
}
