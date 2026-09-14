-- Additive OPIINA → Muito Mais post-survey reward emit (v1).
-- CREATE INDEX / ADD COLUMN / ADD CONSTRAINT only.
-- No DROP, no DELETE, no TRUNCATE.

-- Customer identity: optional CPF used as customerKey when phone is absent.
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "documentNormalized" TEXT;

CREATE INDEX IF NOT EXISTS "customers_tenantId_documentNormalized_idx"
    ON "customers"("tenantId", "documentNormalized");

-- Campaign: eligibility + fixed BRL amount + MM operator config.
ALTER TABLE "coupon_campaigns" ADD COLUMN IF NOT EXISTS "surveyId" UUID;
ALTER TABLE "coupon_campaigns" ADD COLUMN IF NOT EXISTS "mmCompanyId" TEXT;
ALTER TABLE "coupon_campaigns" ADD COLUMN IF NOT EXISTS "rewardEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "coupon_campaigns" ADD COLUMN IF NOT EXISTS "rewardAmountCents" INTEGER;
ALTER TABLE "coupon_campaigns" ADD COLUMN IF NOT EXISTS "validityDays" INTEGER;

DO $$ BEGIN
    ALTER TABLE "coupon_campaigns"
        ADD CONSTRAINT "coupon_campaigns_surveyId_fkey"
        FOREIGN KEY ("surveyId") REFERENCES "surveys"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "coupon_campaigns_tenantId_surveyId_status_idx"
    ON "coupon_campaigns"("tenantId", "surveyId", "status");

-- Issued code: snapshot + one code per (campaign, customerKey).
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "customerKey" TEXT;
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "amountCents" INTEGER;
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "mmCompanyId" TEXT;
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "surveyResponseId" UUID;

DO $$ BEGIN
    ALTER TABLE "coupons"
        ADD CONSTRAINT "coupons_surveyResponseId_fkey"
        FOREIGN KEY ("surveyResponseId") REFERENCES "survey_responses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "coupons_campaignId_customerKey_key"
    ON "coupons"("campaignId", "customerKey");

CREATE INDEX IF NOT EXISTS "coupons_tenantId_customerKey_idx"
    ON "coupons"("tenantId", "customerKey");
