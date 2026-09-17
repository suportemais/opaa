-- Additive: Prêmios campaigns/coupons snapshot one unit CNPJ (never tenant/matriz).
-- ADD COLUMN / CREATE INDEX / ADD CONSTRAINT only.
-- No DROP, no DELETE, no TRUNCATE. Does not rewrite existing coupon/campaign rows.

ALTER TABLE "coupon_campaigns" ADD COLUMN IF NOT EXISTS "unitId" UUID;
ALTER TABLE "coupon_campaigns" ADD COLUMN IF NOT EXISTS "issuerCnpj" TEXT;
ALTER TABLE "coupon_campaigns" ADD COLUMN IF NOT EXISTS "issuerLegalName" TEXT;
ALTER TABLE "coupon_campaigns" ADD COLUMN IF NOT EXISTS "issuerTradeName" TEXT;

CREATE INDEX IF NOT EXISTS "coupon_campaigns_tenantId_unitId_idx"
    ON "coupon_campaigns"("tenantId", "unitId");
CREATE INDEX IF NOT EXISTS "coupon_campaigns_issuerCnpj_idx"
    ON "coupon_campaigns"("issuerCnpj");

DO $$ BEGIN
    ALTER TABLE "coupon_campaigns"
        ADD CONSTRAINT "coupon_campaigns_unitId_fkey"
        FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "unitId" UUID;
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "issuerCnpj" TEXT;
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "issuerLegalName" TEXT;
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "issuerTradeName" TEXT;

CREATE INDEX IF NOT EXISTS "coupons_unitId_idx"
    ON "coupons"("unitId");
CREATE INDEX IF NOT EXISTS "coupons_issuerCnpj_idx"
    ON "coupons"("issuerCnpj");

DO $$ BEGIN
    ALTER TABLE "coupons"
        ADD CONSTRAINT "coupons_unitId_fkey"
        FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
