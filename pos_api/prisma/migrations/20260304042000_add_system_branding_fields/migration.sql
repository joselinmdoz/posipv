-- Add configurable branding fields for topbar/logo
ALTER TABLE "SystemSettings"
  ADD COLUMN "systemName" TEXT NOT NULL DEFAULT 'POS System',
  ADD COLUMN "systemLogoUrl" TEXT;
