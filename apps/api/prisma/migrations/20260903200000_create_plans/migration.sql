-- Additive catalog of public pricing plans.
-- CREATE TABLE / indexes only. No DROP, no DELETE, no tenant/subscription cascade.

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
