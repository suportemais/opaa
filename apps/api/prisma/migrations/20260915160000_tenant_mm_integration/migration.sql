-- Additive tenant ↔ Muito Mais company link (self-serve API key).
-- CREATE TABLE / CREATE INDEX only.
-- No DROP, no DELETE, no TRUNCATE. Does not wipe existing tenants or campaigns.

CREATE TABLE IF NOT EXISTS "tenant_mm_integrations" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "mmCompanyId" TEXT NOT NULL,
    "tradeName" TEXT,
    "apiKeyEncrypted" TEXT NOT NULL,
    "apiKeyLast4" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_mm_integrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_mm_integrations_tenantId_key"
    ON "tenant_mm_integrations"("tenantId");

CREATE INDEX IF NOT EXISTS "tenant_mm_integrations_mmCompanyId_idx"
    ON "tenant_mm_integrations"("mmCompanyId");

DO $$ BEGIN
    ALTER TABLE "tenant_mm_integrations"
        ADD CONSTRAINT "tenant_mm_integrations_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
