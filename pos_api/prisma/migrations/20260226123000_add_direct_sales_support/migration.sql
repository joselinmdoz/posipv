-- Add support for direct (non-TPV) sales flow
DO $$
BEGIN
  CREATE TYPE "SaleChannel" AS ENUM ('TPV', 'DIRECT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Sale"
  ADD COLUMN "channel" "SaleChannel" NOT NULL DEFAULT 'TPV',
  ADD COLUMN "customerName" TEXT,
  ADD COLUMN "documentNumber" TEXT,
  ADD COLUMN "warehouseId" TEXT;

ALTER TABLE "Sale"
  ALTER COLUMN "cashSessionId" DROP NOT NULL;

-- Backfill warehouse from cash session -> register -> warehouse relation
UPDATE "Sale" s
SET "warehouseId" = w."id"
FROM "CashSession" cs
JOIN "Register" r ON r."id" = cs."registerId"
LEFT JOIN "Warehouse" w ON w."registerId" = r."id"
WHERE s."cashSessionId" = cs."id"
  AND s."warehouseId" IS NULL;

CREATE UNIQUE INDEX "Sale_documentNumber_key" ON "Sale"("documentNumber");
CREATE INDEX "Sale_channel_createdAt_idx" ON "Sale"("channel", "createdAt");
CREATE INDEX "Sale_warehouseId_createdAt_idx" ON "Sale"("warehouseId", "createdAt");

ALTER TABLE "Sale"
  ADD CONSTRAINT "Sale_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
