-- Additive platform admin + billing fields.
-- CREATE TABLE / ADD COLUMN / CREATE INDEX only.
-- No DROP, no DELETE, no TRUNCATE, no tenant/subscription cascade.

-- Catalog of public pricing plans (IF NOT EXISTS so this is safe if PR de planos já criou a tabela).
CREATE TABLE IF NOT EXISTS "plans" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "shortDescription" TEXT,
    "description" TEXT,
    "badge" TEXT,
    "ctaLabel" TEXT NOT NULL DEFAULT 'Assinar',
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "billingInterval" TEXT NOT NULL DEFAULT 'MONTH',
    "trialDays" INTEGER NOT NULL DEFAULT 14,
    "features" JSONB NOT NULL,
    "maxUnits" INTEGER,
    "maxUsers" INTEGER,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "annualAmountCents" INTEGER,
    "stripePriceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "plans_slug_key" ON "plans"("slug");

CREATE INDEX IF NOT EXISTS "plans_isPublic_displayOrder_idx"
    ON "plans"("isPublic", "displayOrder");

-- Billing enums (ADDITIVE).
DO $$ BEGIN
    CREATE TYPE "BillingMode" AS ENUM ('stripe', 'manual');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "ManualAccessReason" AS ENUM ('manual', 'cortesia', 'trial_grant');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Tenant billing columns (ADDITIVE). Existing rows keep self-serve default `stripe`.
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "billingMode" "BillingMode" NOT NULL DEFAULT 'stripe';
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "planId" UUID;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3);
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "accessValidUntil" TIMESTAMP(3);
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "manualAccessReason" "ManualAccessReason";
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "isPlatform" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "tenants_billingMode_idx" ON "tenants"("billingMode");
CREATE INDEX IF NOT EXISTS "tenants_planId_idx" ON "tenants"("planId");

DO $$ BEGIN
    ALTER TABLE "tenants"
        ADD CONSTRAINT "tenants_planId_fkey"
        FOREIGN KEY ("planId") REFERENCES "plans"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Global platform_admin role: unique when tenantId IS NULL (additive index only).
CREATE UNIQUE INDEX IF NOT EXISTS "roles_global_code_key"
    ON "roles" ("code")
    WHERE "tenantId" IS NULL;
