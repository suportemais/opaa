-- Additive: last-4 for masked UI (••••abcd). No DROP / DELETE / TRUNCATE.

ALTER TABLE "tenant_mm_integrations"
    ADD COLUMN IF NOT EXISTS "apiKeyLast4" TEXT;
