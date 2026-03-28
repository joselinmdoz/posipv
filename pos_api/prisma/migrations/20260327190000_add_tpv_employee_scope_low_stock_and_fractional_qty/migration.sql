-- TPV employee scope + product stock alerts + fractional quantities support

-- Register settings: allowed employees to sell in this TPV
ALTER TABLE "RegisterSettings"
  ADD COLUMN IF NOT EXISTS "sellerEmployeeIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Product: low-stock threshold and fractional sales support
ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "lowStockAlertQty" DECIMAL(12,3),
  ADD COLUMN IF NOT EXISTS "allowFractionalQty" BOOLEAN NOT NULL DEFAULT false;

-- Quantities as decimals to support weighted products (e.g. 2.5 lb)
ALTER TABLE "SaleItem"
  ALTER COLUMN "qty" TYPE DECIMAL(12,3) USING "qty"::DECIMAL(12,3);

ALTER TABLE "PurchaseItem"
  ALTER COLUMN "qty" TYPE DECIMAL(12,3) USING "qty"::DECIMAL(12,3);

ALTER TABLE "Stock"
  ALTER COLUMN "qty" TYPE DECIMAL(12,3) USING "qty"::DECIMAL(12,3);

ALTER TABLE "StockMovement"
  ALTER COLUMN "qty" TYPE DECIMAL(12,3) USING "qty"::DECIMAL(12,3);

ALTER TABLE "InventoryReportItem"
  ALTER COLUMN "qty" TYPE DECIMAL(12,3) USING "qty"::DECIMAL(12,3);
