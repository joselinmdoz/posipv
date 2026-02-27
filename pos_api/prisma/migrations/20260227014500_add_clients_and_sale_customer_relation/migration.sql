-- Create clients catalog and relate sales to clients
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "identification" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Client_identification_key" ON "Client"("identification");
CREATE INDEX "Client_name_idx" ON "Client"("name");

ALTER TABLE "Sale" ADD COLUMN "customerId" TEXT;
CREATE INDEX "Sale_customerId_createdAt_idx" ON "Sale"("customerId", "createdAt");

ALTER TABLE "Sale"
  ADD CONSTRAINT "Sale_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Client"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
