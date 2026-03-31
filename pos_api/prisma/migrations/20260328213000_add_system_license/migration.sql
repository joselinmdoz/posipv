CREATE TABLE "SystemLicense" (
    "id" TEXT NOT NULL,
    "licenseData" TEXT,
    "payloadJson" JSONB,
    "payloadHash" TEXT,
    "licenseId" TEXT,
    "deviceHash" TEXT,
    "issuedAt" TIMESTAMP(3),
    "validFrom" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "maxUsers" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'MISSING',
    "statusMessage" TEXT,
    "lastValidatedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SystemLicense_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SystemLicense_licenseId_key" ON "SystemLicense"("licenseId");
