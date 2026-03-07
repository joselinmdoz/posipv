-- Accounting posting rules for configurable automatic postings

CREATE TYPE "AccountingPostingRuleKey" AS ENUM (
  'SALE_REVENUE_CUP',
  'SALE_REVENUE_USD',
  'SALE_COGS',
  'STOCK_IN',
  'STOCK_OUT'
);

CREATE TABLE "AccountingPostingRule" (
  "id" TEXT NOT NULL,
  "key" "AccountingPostingRuleKey" NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "debitAccountId" TEXT NOT NULL,
  "creditAccountId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccountingPostingRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccountingPostingRule_key_key" ON "AccountingPostingRule"("key");
CREATE INDEX "AccountingPostingRule_active_key_idx" ON "AccountingPostingRule"("active", "key");

ALTER TABLE "AccountingPostingRule"
ADD CONSTRAINT "AccountingPostingRule_debitAccountId_fkey"
FOREIGN KEY ("debitAccountId") REFERENCES "AccountingAccount"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AccountingPostingRule"
ADD CONSTRAINT "AccountingPostingRule_creditAccountId_fkey"
FOREIGN KEY ("creditAccountId") REFERENCES "AccountingAccount"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
