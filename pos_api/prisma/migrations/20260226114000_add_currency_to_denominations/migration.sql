-- Add currency per denomination to support multi-currency cash configurations by TPV
ALTER TABLE "Denomination"
  ADD COLUMN "currency" "CurrencyCode" NOT NULL DEFAULT 'CUP';

-- Backfill from register settings currency when available (fallback CUP)
UPDATE "Denomination" d
SET "currency" = CASE
  WHEN UPPER(COALESCE(rs."currency", 'CUP')) = 'USD' THEN 'USD'::"CurrencyCode"
  ELSE 'CUP'::"CurrencyCode"
END
FROM "RegisterSettings" rs
WHERE d."registerSettingsId" = rs."id";

CREATE INDEX "Denomination_registerSettingsId_currency_idx"
  ON "Denomination"("registerSettingsId", "currency");

CREATE UNIQUE INDEX "Denomination_registerSettingsId_currency_value_key"
  ON "Denomination"("registerSettingsId", "currency", "value");
