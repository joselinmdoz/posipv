-- Catalog tables used by product-related modules
CREATE TABLE IF NOT EXISTS "ProductType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProductCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MeasurementUnitType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MeasurementUnitType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MeasurementUnit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "typeId" TEXT,
    CONSTRAINT "MeasurementUnit_pkey" PRIMARY KEY ("id")
);

-- Product schema drift fix: columns expected by current Prisma schema
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "codigo" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "productTypeId" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "productCategoryId" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "measurementUnitId" TEXT;

-- Backfill legacy sku -> codigo to preserve existing identifiers
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'Product'
      AND column_name = 'sku'
  ) THEN
    UPDATE "Product"
    SET "codigo" = "sku"
    WHERE "codigo" IS NULL
      AND "sku" IS NOT NULL;
  END IF;
END $$;

-- Ensure expected uniques
CREATE UNIQUE INDEX IF NOT EXISTS "Product_codigo_key" ON "Product"("codigo");

-- Foreign keys (guarded to avoid conflicts on re-runs)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'MeasurementUnit_typeId_fkey'
  ) THEN
    ALTER TABLE "MeasurementUnit"
      ADD CONSTRAINT "MeasurementUnit_typeId_fkey"
      FOREIGN KEY ("typeId") REFERENCES "MeasurementUnitType"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Product_productTypeId_fkey'
  ) THEN
    ALTER TABLE "Product"
      ADD CONSTRAINT "Product_productTypeId_fkey"
      FOREIGN KEY ("productTypeId") REFERENCES "ProductType"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Product_productCategoryId_fkey'
  ) THEN
    ALTER TABLE "Product"
      ADD CONSTRAINT "Product_productCategoryId_fkey"
      FOREIGN KEY ("productCategoryId") REFERENCES "ProductCategory"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Product_measurementUnitId_fkey'
  ) THEN
    ALTER TABLE "Product"
      ADD CONSTRAINT "Product_measurementUnitId_fkey"
      FOREIGN KEY ("measurementUnitId") REFERENCES "MeasurementUnit"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
