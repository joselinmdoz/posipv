ALTER TABLE "PaymentMethodSetting"
  ADD COLUMN "requiresTransactionCode" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Payment"
  ADD COLUMN "transactionCode" TEXT;
