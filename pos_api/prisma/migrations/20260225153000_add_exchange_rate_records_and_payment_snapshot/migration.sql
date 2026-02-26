-- CreateEnum
CREATE TYPE "CurrencyCode" AS ENUM ('CUP', 'USD');

-- CreateTable
CREATE TABLE "ExchangeRateRecord" (
    "id" TEXT NOT NULL,
    "baseCurrency" "CurrencyCode" NOT NULL DEFAULT 'USD',
    "quoteCurrency" "CurrencyCode" NOT NULL DEFAULT 'CUP',
    "rate" DECIMAL(12,6) NOT NULL,
    "source" TEXT DEFAULT 'SYSTEM_SETTINGS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeRateRecord_pkey" PRIMARY KEY ("id")
);

-- AlterTable Payment: add snapshot fields
ALTER TABLE "Payment" ADD COLUMN "currency" "CurrencyCode" NOT NULL DEFAULT 'CUP';
ALTER TABLE "Payment" ADD COLUMN "amountOriginal" DECIMAL(12,2);
ALTER TABLE "Payment" ADD COLUMN "exchangeRateUsdToCup" DECIMAL(12,6);
ALTER TABLE "Payment" ADD COLUMN "exchangeRateRecordId" TEXT;

-- Backfill existing payments
UPDATE "Payment" SET "amountOriginal" = "amount" WHERE "amountOriginal" IS NULL;

-- Make amountOriginal required after backfill
ALTER TABLE "Payment" ALTER COLUMN "amountOriginal" SET NOT NULL;

-- Convert SystemSettings currency columns to enum
ALTER TABLE "SystemSettings"
  ALTER COLUMN "defaultCurrency" DROP DEFAULT;

ALTER TABLE "SystemSettings"
  ALTER COLUMN "defaultCurrency" TYPE "CurrencyCode"
  USING "defaultCurrency"::"CurrencyCode";

ALTER TABLE "SystemSettings"
  ALTER COLUMN "defaultCurrency" SET DEFAULT 'CUP';

ALTER TABLE "SystemSettings"
  ALTER COLUMN "enabledCurrencies" DROP DEFAULT;

ALTER TABLE "SystemSettings"
  ALTER COLUMN "enabledCurrencies" TYPE "CurrencyCode"[]
  USING ("enabledCurrencies"::text[]::"CurrencyCode"[]);

ALTER TABLE "SystemSettings"
  ALTER COLUMN "enabledCurrencies" SET DEFAULT ARRAY['CUP', 'USD']::"CurrencyCode"[];

-- Seed a first exchange rate record from current system settings if missing
INSERT INTO "ExchangeRateRecord" ("id", "baseCurrency", "quoteCurrency", "rate", "source", "createdAt")
SELECT
  'rate_seed_default',
  'USD'::"CurrencyCode",
  'CUP'::"CurrencyCode",
  COALESCE("exchangeRateUsdToCup", 1),
  'SYSTEM_SETTINGS',
  CURRENT_TIMESTAMP
FROM "SystemSettings"
WHERE "id" = 'default'
AND NOT EXISTS (SELECT 1 FROM "ExchangeRateRecord");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_exchangeRateRecordId_fkey" FOREIGN KEY ("exchangeRateRecordId") REFERENCES "ExchangeRateRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
