-- Schema drift fix for Warehouse/RegisterSettings models used by API

-- Warehouse.registerId (1:1 optional link with Register)
ALTER TABLE "Warehouse" ADD COLUMN IF NOT EXISTS "registerId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Warehouse_registerId_key" ON "Warehouse"("registerId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Warehouse_registerId_fkey'
  ) THEN
    ALTER TABLE "Warehouse"
      ADD CONSTRAINT "Warehouse_registerId_fkey"
      FOREIGN KEY ("registerId") REFERENCES "Register"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- RegisterSettings columns expected by current Prisma schema
ALTER TABLE "RegisterSettings" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "RegisterSettings" ADD COLUMN IF NOT EXISTS "warehouseId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'RegisterSettings_warehouseId_fkey'
  ) THEN
    ALTER TABLE "RegisterSettings"
      ADD CONSTRAINT "RegisterSettings_warehouseId_fkey"
      FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
