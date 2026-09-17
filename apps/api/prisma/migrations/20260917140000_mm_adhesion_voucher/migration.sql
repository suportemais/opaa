-- Additive 7-digit MM adhesion vouchers (issuer CNPJ attribution).
-- CREATE TYPE / CREATE TABLE / CREATE INDEX only.
-- No DROP, no DELETE, no TRUNCATE. Does not touch coupons, campaigns, or integrations.

DO $$ BEGIN
    CREATE TYPE "MmAdhesionVoucherStatus" AS ENUM ('unused', 'used', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "mm_adhesion_vouchers" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "issuerCnpj" TEXT NOT NULL,
    "issuerLegalName" TEXT NOT NULL,
    "issuerTradeName" TEXT NOT NULL,
    "amountCents" INTEGER,
    "rules" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "MmAdhesionVoucherStatus" NOT NULL DEFAULT 'unused',
    "usedAt" TIMESTAMP(3),
    "usedByMmUserId" TEXT,
    "usedByMmCompanyId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mm_adhesion_vouchers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "mm_adhesion_vouchers_code_key"
    ON "mm_adhesion_vouchers"("code");

CREATE INDEX IF NOT EXISTS "mm_adhesion_vouchers_tenantId_createdAt_idx"
    ON "mm_adhesion_vouchers"("tenantId", "createdAt");

CREATE INDEX IF NOT EXISTS "mm_adhesion_vouchers_issuerCnpj_idx"
    ON "mm_adhesion_vouchers"("issuerCnpj");

CREATE INDEX IF NOT EXISTS "mm_adhesion_vouchers_status_expiresAt_idx"
    ON "mm_adhesion_vouchers"("status", "expiresAt");

DO $$ BEGIN
    ALTER TABLE "mm_adhesion_vouchers"
        ADD CONSTRAINT "mm_adhesion_vouchers_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
