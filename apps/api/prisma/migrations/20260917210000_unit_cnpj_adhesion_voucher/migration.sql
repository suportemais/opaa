-- Additive: each unit can hold its own CNPJ; adhesion vouchers bind that unit at mint.
-- ADD COLUMN / CREATE INDEX / ADD CONSTRAINT only.
-- No DROP, no DELETE, no TRUNCATE. Does not rewrite existing voucher issuer snapshots.

ALTER TABLE "units" ADD COLUMN IF NOT EXISTS "document" TEXT;
ALTER TABLE "units" ADD COLUMN IF NOT EXISTS "legalName" TEXT;

CREATE INDEX IF NOT EXISTS "units_tenantId_document_idx"
    ON "units"("tenantId", "document");

ALTER TABLE "mm_adhesion_vouchers" ADD COLUMN IF NOT EXISTS "unitId" UUID;

CREATE INDEX IF NOT EXISTS "mm_adhesion_vouchers_unitId_idx"
    ON "mm_adhesion_vouchers"("unitId");

DO $$ BEGIN
    ALTER TABLE "mm_adhesion_vouchers"
        ADD CONSTRAINT "mm_adhesion_vouchers_unitId_fkey"
        FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
