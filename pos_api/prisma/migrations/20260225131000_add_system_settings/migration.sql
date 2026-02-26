-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'CUP',
    "enabledCurrencies" TEXT[] DEFAULT ARRAY['CUP', 'USD']::TEXT[],
    "exchangeRateUsdToCup" DECIMAL(12,6) NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- Seed default singleton row
INSERT INTO "SystemSettings" ("id", "defaultCurrency", "enabledCurrencies", "exchangeRateUsdToCup", "createdAt", "updatedAt")
VALUES ('default', 'CUP', ARRAY['CUP', 'USD']::TEXT[], 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
