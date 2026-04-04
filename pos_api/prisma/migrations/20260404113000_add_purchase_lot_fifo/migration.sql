-- CreateEnum
CREATE TYPE "PurchaseLotSource" AS ENUM ('PURCHASE', 'MANUAL_IN', 'TRANSFER_IN', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "PurchaseLot" (
    "id" TEXT NOT NULL,
    "source" "PurchaseLotSource" NOT NULL DEFAULT 'PURCHASE',
    "purchaseId" TEXT,
    "purchaseItemId" TEXT,
    "warehouseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "reference" TEXT,
    "initialQty" DECIMAL(12,3) NOT NULL,
    "remainingQty" DECIMAL(12,3) NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleItemLotConsumption" (
    "id" TEXT NOT NULL,
    "saleItemId" TEXT NOT NULL,
    "purchaseLotId" TEXT NOT NULL,
    "qty" DECIMAL(12,3) NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "lineCost" DECIMAL(12,2) NOT NULL,
    "lineRevenue" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleItemLotConsumption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PurchaseLot_purchaseId_productId_idx" ON "PurchaseLot"("purchaseId", "productId");

-- CreateIndex
CREATE INDEX "PurchaseLot_warehouseId_productId_receivedAt_idx" ON "PurchaseLot"("warehouseId", "productId", "receivedAt");

-- CreateIndex
CREATE INDEX "SaleItemLotConsumption_saleItemId_idx" ON "SaleItemLotConsumption"("saleItemId");

-- CreateIndex
CREATE INDEX "SaleItemLotConsumption_purchaseLotId_idx" ON "SaleItemLotConsumption"("purchaseLotId");

-- AddForeignKey
ALTER TABLE "PurchaseLot" ADD CONSTRAINT "PurchaseLot_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseLot" ADD CONSTRAINT "PurchaseLot_purchaseItemId_fkey" FOREIGN KEY ("purchaseItemId") REFERENCES "PurchaseItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseLot" ADD CONSTRAINT "PurchaseLot_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseLot" ADD CONSTRAINT "PurchaseLot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItemLotConsumption" ADD CONSTRAINT "SaleItemLotConsumption_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "SaleItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItemLotConsumption" ADD CONSTRAINT "SaleItemLotConsumption_purchaseLotId_fkey" FOREIGN KEY ("purchaseLotId") REFERENCES "PurchaseLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

