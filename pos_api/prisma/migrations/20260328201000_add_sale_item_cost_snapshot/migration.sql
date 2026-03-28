ALTER TABLE "SaleItem"
ADD COLUMN "costSnapshot" DECIMAL(12,2);

UPDATE "SaleItem" AS si
SET "costSnapshot" = p."cost"
FROM "Product" AS p
WHERE si."productId" = p."id"
  AND si."costSnapshot" IS NULL;
