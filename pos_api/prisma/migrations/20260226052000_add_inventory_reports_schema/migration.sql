-- Inventory reports schema expected by current Prisma models

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'IPVType'
  ) THEN
    CREATE TYPE "IPVType" AS ENUM ('INITIAL', 'FINAL');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "InventoryReport" (
  "id" TEXT NOT NULL,
  "type" "IPVType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "totalValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "note" TEXT,
  "cashSessionId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  CONSTRAINT "InventoryReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InventoryReportItem" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "qty" INTEGER NOT NULL,
  "price" DECIMAL(12,2) NOT NULL,
  "total" DECIMAL(12,2) NOT NULL,
  "inventoryReportId" TEXT NOT NULL,
  CONSTRAINT "InventoryReportItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InventoryReport_cashSessionId_idx" ON "InventoryReport"("cashSessionId");
CREATE INDEX IF NOT EXISTS "InventoryReport_warehouseId_idx" ON "InventoryReport"("warehouseId");
CREATE INDEX IF NOT EXISTS "InventoryReportItem_inventoryReportId_idx" ON "InventoryReportItem"("inventoryReportId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'InventoryReport_cashSessionId_fkey'
  ) THEN
    ALTER TABLE "InventoryReport"
      ADD CONSTRAINT "InventoryReport_cashSessionId_fkey"
      FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'InventoryReport_warehouseId_fkey'
  ) THEN
    ALTER TABLE "InventoryReport"
      ADD CONSTRAINT "InventoryReport_warehouseId_fkey"
      FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'InventoryReportItem_productId_fkey'
  ) THEN
    ALTER TABLE "InventoryReportItem"
      ADD CONSTRAINT "InventoryReportItem_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'InventoryReportItem_inventoryReportId_fkey'
  ) THEN
    ALTER TABLE "InventoryReportItem"
      ADD CONSTRAINT "InventoryReportItem_inventoryReportId_fkey"
      FOREIGN KEY ("inventoryReportId") REFERENCES "InventoryReport"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
