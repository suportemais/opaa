-- AlterTable
ALTER TABLE "tenants" ADD COLUMN "stripeSubscriptionStatus" TEXT;
ALTER TABLE "tenants" ADD COLUMN "stripeCurrentPeriodEnd" TIMESTAMP(3);
ALTER TABLE "tenants" ADD COLUMN "stripeCancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "tenants_stripeCustomerId_idx" ON "tenants"("stripeCustomerId");
CREATE INDEX "tenants_stripeSubscriptionId_idx" ON "tenants"("stripeSubscriptionId");

-- CreateTable
CREATE TABLE "stripe_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "tenantId" UUID,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stripe_events_tenantId_idx" ON "stripe_events"("tenantId");
