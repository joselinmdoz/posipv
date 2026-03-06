-- Add per-user permissions and employees catalog
ALTER TABLE "User"
  ADD COLUMN "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "Employee" (
  "id" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "identification" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "position" TEXT,
  "hireDate" TIMESTAMP(3),
  "salary" DECIMAL(12,2),
  "notes" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "userId" TEXT,

  CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Employee_identification_key" ON "Employee"("identification");
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");
CREATE INDEX "Employee_firstName_lastName_idx" ON "Employee"("firstName", "lastName");
CREATE INDEX "Employee_active_idx" ON "Employee"("active");

ALTER TABLE "Employee"
  ADD CONSTRAINT "Employee_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
