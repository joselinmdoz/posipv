-- CreateTable
CREATE TABLE "ManualIvpReport" (
    "id" TEXT NOT NULL,
    "registerId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "employeeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "paymentBreakdown" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualIvpReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualIvpReportLine" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "initialQty" DECIMAL(12,3) NOT NULL,
    "entriesQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "outsQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "salesQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "totalQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "finalQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "price" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gp" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gain" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "ManualIvpReportLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ManualIvpReport_registerId_reportDate_key" ON "ManualIvpReport"("registerId", "reportDate");

-- CreateIndex
CREATE INDEX "ManualIvpReport_registerId_createdAt_idx" ON "ManualIvpReport"("registerId", "createdAt");

-- CreateIndex
CREATE INDEX "ManualIvpReport_warehouseId_createdAt_idx" ON "ManualIvpReport"("warehouseId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ManualIvpReportLine_reportId_productId_key" ON "ManualIvpReportLine"("reportId", "productId");

-- CreateIndex
CREATE INDEX "ManualIvpReportLine_productId_idx" ON "ManualIvpReportLine"("productId");

-- AddForeignKey
ALTER TABLE "ManualIvpReport" ADD CONSTRAINT "ManualIvpReport_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "Register"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualIvpReport" ADD CONSTRAINT "ManualIvpReport_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualIvpReport" ADD CONSTRAINT "ManualIvpReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualIvpReportLine" ADD CONSTRAINT "ManualIvpReportLine_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ManualIvpReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualIvpReportLine" ADD CONSTRAINT "ManualIvpReportLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
