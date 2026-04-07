import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma, PurchaseLotSource } from "@prisma/client";
import { dec } from "../../common/decimal";

type PurchaseLotInput = {
  purchaseId: string;
  purchaseItemId?: string | null;
  warehouseId: string;
  productId: string;
  qty: number | Prisma.Decimal;
  unitCost: number | Prisma.Decimal;
  reference?: string | null;
  receivedAt?: Date;
};

type SaleItemFifoInput = {
  saleId: string;
  saleItemId: string;
  warehouseId: string;
  productId: string;
  qty: number | Prisma.Decimal;
  unitPrice: number | Prisma.Decimal;
  fallbackUnitCost?: number | Prisma.Decimal | null;
};

type AdjustmentLotInput = {
  warehouseId: string;
  productId: string;
  qty: number | Prisma.Decimal;
  unitCost?: number | Prisma.Decimal | null;
  reference?: string | null;
  receivedAt?: Date;
};

type ConsumeStockInput = {
  warehouseId: string;
  productId: string;
  qty: number | Prisma.Decimal;
  fallbackUnitCost?: number | Prisma.Decimal | null;
  reference?: string | null;
  receivedAt?: Date;
};

@Injectable()
export class InventoryCostingService {
  async createPurchaseLots(
    tx: Prisma.TransactionClient,
    rows: PurchaseLotInput[],
  ) {
    for (const row of rows) {
      const qty = this.parseQty(row.qty);
      const unitCost = this.parseMoney(row.unitCost);
      await tx.purchaseLot.create({
        data: {
          source: PurchaseLotSource.PURCHASE,
          purchaseId: row.purchaseId,
          purchaseItemId: row.purchaseItemId || null,
          warehouseId: row.warehouseId,
          productId: row.productId,
          reference: row.reference || null,
          initialQty: dec(qty.toFixed(3)),
          remainingQty: dec(qty.toFixed(3)),
          unitCost: dec(unitCost.toFixed(2)),
          receivedAt: row.receivedAt || new Date(),
        },
      });
    }
  }

  async ensurePurchaseLotsCanBeVoided(
    tx: Prisma.TransactionClient,
    purchaseId: string,
  ) {
    const lots = await tx.purchaseLot.findMany({
      where: { purchaseId },
      select: { id: true, initialQty: true, remainingQty: true },
    });

    const consumedLot = lots.find(
      (lot) => dec(lot.remainingQty).lt(dec(lot.initialQty)),
    );
    if (consumedLot) {
      throw new BadRequestException(
        "No se puede anular la compra porque ya tiene consumos en ventas (FIFO).",
      );
    }
  }

  async deletePurchaseLots(tx: Prisma.TransactionClient, purchaseId: string) {
    await tx.purchaseLot.deleteMany({ where: { purchaseId } });
  }

  async consumeSaleItemsWithFifo(
    tx: Prisma.TransactionClient,
    items: SaleItemFifoInput[],
  ) {
    if (!items.length) {
      return new Map<string, Prisma.Decimal>();
    }

    const saleId = items[0]!.saleId;
    const warehouseId = items[0]!.warehouseId;
    const productIds = Array.from(new Set(items.map((item) => item.productId)));

    const lots = await tx.purchaseLot.findMany({
      where: {
        warehouseId,
        productId: { in: productIds },
        remainingQty: { gt: 0 },
      },
      select: {
        id: true,
        productId: true,
        remainingQty: true,
        unitCost: true,
      },
      orderBy: [{ receivedAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    });

    const lotQueueByProduct = new Map<
      string,
      Array<{ id: string; remainingQty: Prisma.Decimal; unitCost: Prisma.Decimal }>
    >();
    for (const lot of lots) {
      const queue = lotQueueByProduct.get(lot.productId) || [];
      queue.push({
        id: lot.id,
        remainingQty: dec(lot.remainingQty),
        unitCost: dec(lot.unitCost),
      });
      lotQueueByProduct.set(lot.productId, queue);
    }

    const averageCostBySaleItem = new Map<string, Prisma.Decimal>();

    for (const item of items) {
      let pendingQty = dec(this.parseQty(item.qty));
      const lineQty = dec(this.parseQty(item.qty));
      const unitPrice = dec(this.parseMoney(item.unitPrice));
      const fallbackUnitCost = dec(this.parseMoney(item.fallbackUnitCost ?? 0));
      let lineCost = dec(0);

      let queue = lotQueueByProduct.get(item.productId) || [];
      if (!lotQueueByProduct.has(item.productId)) {
        lotQueueByProduct.set(item.productId, queue);
      }

      while (pendingQty.gt(0)) {
        let head = queue.find((lot) => lot.remainingQty.gt(0));

        if (!head) {
          const created = await tx.purchaseLot.create({
            data: {
              source: PurchaseLotSource.ADJUSTMENT,
              warehouseId: item.warehouseId,
              productId: item.productId,
              reference: `AUTO_BALANCE:${saleId}`,
              initialQty: dec(pendingQty.toFixed(3)),
              remainingQty: dec(pendingQty.toFixed(3)),
              unitCost: dec(fallbackUnitCost.toFixed(2)),
              receivedAt: new Date(),
            },
            select: {
              id: true,
              remainingQty: true,
              unitCost: true,
            },
          });
          head = {
            id: created.id,
            remainingQty: dec(created.remainingQty),
            unitCost: dec(created.unitCost),
          };
          queue.push(head);
        }

        const takeQty = head.remainingQty.greaterThan(pendingQty)
          ? dec(pendingQty.toFixed(3))
          : dec(head.remainingQty.toFixed(3));
        if (takeQty.lte(0)) break;

        const updated = await tx.purchaseLot.updateMany({
          where: {
            id: head.id,
            remainingQty: { gte: dec(takeQty.toFixed(3)) },
          },
          data: {
            remainingQty: { decrement: dec(takeQty.toFixed(3)) },
          },
        });

        if (updated.count === 0) {
          throw new BadRequestException(
            "Conflicto de inventario al aplicar FIFO. Reintente la venta.",
          );
        }

        head.remainingQty = dec(head.remainingQty.sub(takeQty).toFixed(3));
        pendingQty = dec(pendingQty.sub(takeQty).toFixed(3));

        const partialLineCost = dec(head.unitCost.mul(takeQty).toFixed(2));
        const partialLineRevenue = dec(unitPrice.mul(takeQty).toFixed(2));
        lineCost = dec(lineCost.add(partialLineCost).toFixed(2));

        await tx.saleItemLotConsumption.create({
          data: {
            saleItemId: item.saleItemId,
            purchaseLotId: head.id,
            qty: dec(takeQty.toFixed(3)),
            unitCost: dec(head.unitCost.toFixed(2)),
            lineCost: dec(partialLineCost.toFixed(2)),
            lineRevenue: dec(partialLineRevenue.toFixed(2)),
          },
        });
      }

      const averageUnitCost = lineQty.gt(0)
        ? dec(lineCost.div(lineQty).toFixed(2))
        : dec(0);
      averageCostBySaleItem.set(item.saleItemId, averageUnitCost);
    }

    return averageCostBySaleItem;
  }

  async restoreSaleLots(tx: Prisma.TransactionClient, saleId: string) {
    const consumptions = await tx.saleItemLotConsumption.findMany({
      where: {
        saleItem: { saleId },
      },
      select: {
        purchaseLotId: true,
        qty: true,
      },
    });

    const qtyByLot = new Map<string, Prisma.Decimal>();
    for (const row of consumptions) {
      const current = qtyByLot.get(row.purchaseLotId) || dec(0);
      qtyByLot.set(
        row.purchaseLotId,
        dec(current.add(dec(row.qty)).toFixed(3)),
      );
    }

    for (const [purchaseLotId, qty] of qtyByLot.entries()) {
      await tx.purchaseLot.update({
        where: { id: purchaseLotId },
        data: {
          remainingQty: { increment: dec(qty.toFixed(3)) },
        },
      });
    }
  }

  async createAdjustmentLot(
    tx: Prisma.TransactionClient,
    input: AdjustmentLotInput,
  ) {
    const qty = this.parseQty(input.qty);
    const unitCost = this.parseMoney(input.unitCost ?? 0);
    if (qty <= 0) return null;

    return tx.purchaseLot.create({
      data: {
        source: PurchaseLotSource.ADJUSTMENT,
        warehouseId: input.warehouseId,
        productId: input.productId,
        reference: input.reference || null,
        initialQty: dec(qty.toFixed(3)),
        remainingQty: dec(qty.toFixed(3)),
        unitCost: dec(unitCost.toFixed(2)),
        receivedAt: input.receivedAt || new Date(),
      },
      select: {
        id: true,
        remainingQty: true,
        unitCost: true,
      },
    });
  }

  async consumeStockWithFifo(
    tx: Prisma.TransactionClient,
    input: ConsumeStockInput,
  ) {
    let pendingQty = dec(this.parseQty(input.qty));
    const fallbackUnitCost = dec(this.parseMoney(input.fallbackUnitCost ?? 0));
    let totalCost = dec(0);
    const requestedQty = dec(pendingQty.toFixed(3));

    const lots = await tx.purchaseLot.findMany({
      where: {
        warehouseId: input.warehouseId,
        productId: input.productId,
        remainingQty: { gt: 0 },
      },
      select: {
        id: true,
        remainingQty: true,
        unitCost: true,
      },
      orderBy: [{ receivedAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    });

    const queue: Array<{ id: string; remainingQty: Prisma.Decimal; unitCost: Prisma.Decimal }> = lots.map((lot) => ({
      id: lot.id,
      remainingQty: dec(lot.remainingQty),
      unitCost: dec(lot.unitCost),
    }));

    while (pendingQty.gt(0)) {
      let head = queue.find((lot) => lot.remainingQty.gt(0));

      if (!head) {
        const created = await this.createAdjustmentLot(tx, {
          warehouseId: input.warehouseId,
          productId: input.productId,
          qty: pendingQty,
          unitCost: fallbackUnitCost,
          reference: input.reference || null,
          receivedAt: input.receivedAt,
        });

        if (!created) break;
        head = {
          id: created.id,
          remainingQty: dec(created.remainingQty),
          unitCost: dec(created.unitCost),
        };
        queue.push(head);
      }

      const takeQty = head.remainingQty.greaterThan(pendingQty)
        ? dec(pendingQty.toFixed(3))
        : dec(head.remainingQty.toFixed(3));
      if (takeQty.lte(0)) break;

      const updated = await tx.purchaseLot.updateMany({
        where: {
          id: head.id,
          remainingQty: { gte: dec(takeQty.toFixed(3)) },
        },
        data: {
          remainingQty: { decrement: dec(takeQty.toFixed(3)) },
        },
      });

      if (updated.count === 0) {
        throw new BadRequestException(
          "Conflicto de inventario al aplicar FIFO. Reintente la operación.",
        );
      }

      head.remainingQty = dec(head.remainingQty.sub(takeQty).toFixed(3));
      pendingQty = dec(pendingQty.sub(takeQty).toFixed(3));
      totalCost = dec(totalCost.add(head.unitCost.mul(takeQty)).toFixed(2));
    }

    const consumedQty = dec(requestedQty.sub(pendingQty).toFixed(3));
    const averageUnitCost = consumedQty.gt(0)
      ? dec(totalCost.div(consumedQty).toFixed(2))
      : dec(0);

    return {
      qty: Number(consumedQty.toFixed(3)),
      totalCost: Number(totalCost.toFixed(2)),
      averageUnitCost: Number(averageUnitCost.toFixed(2)),
    };
  }

  private parseQty(value: number | Prisma.Decimal): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new BadRequestException("Cantidad inválida para operación FIFO.");
    }
    return Number(parsed.toFixed(3));
  }

  private parseMoney(value: number | Prisma.Decimal): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }
    return Number(parsed.toFixed(2));
  }
}
