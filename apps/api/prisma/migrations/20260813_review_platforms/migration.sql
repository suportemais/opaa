-- ============================================================
-- Review Platforms MVP 1
-- Migration: cria enums + tabelas review_sync_profiles e reviews
-- + FK em feedback_cases.case_id
-- Execução idempotente (IF NOT EXISTS / ON CONFLICT)
-- ============================================================

-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE "ReviewPlatform" AS ENUM ('google', 'ifood', 'tripadvisor', 'reclameaqui');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ReviewSentiment" AS ENUM ('positive', 'neutral', 'negative');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SyncFrequency" AS ENUM ('every30m', 'hourly', 'every6h', 'daily');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SyncStatus" AS ENUM ('idle', 'running', 'error', 'paused');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============ TABELA review_sync_profiles ============
CREATE TABLE IF NOT EXISTS "review_sync_profiles" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "unitId" UUID NOT NULL REFERENCES "units"("id") ON DELETE CASCADE,
  "platform" "ReviewPlatform" NOT NULL,
  "publicUrl" VARCHAR,
  "locationId" VARCHAR,
  "apiKeyEncrypted" VARCHAR,
  "syncFrequency" "SyncFrequency" NOT NULL DEFAULT 'hourly',
  "syncStatus" "SyncStatus" NOT NULL DEFAULT 'idle',
  "lastSyncAt" TIMESTAMPTZ,
  "lastError" TEXT,
  "lastRating" DECIMAL(3,2),
  "lastReviewCount" INTEGER,
  "lastPositiveCount" INTEGER,
  "lastNeutralCount" INTEGER,
  "lastNegativeCount" INTEGER,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "review_sync_profiles_tenantId_unitId_platform_key"
  ON "review_sync_profiles" ("tenantId", "unitId", "platform");

CREATE INDEX IF NOT EXISTS "review_sync_profiles_tenantId_unitId_idx"
  ON "review_sync_profiles" ("tenantId", "unitId");


-- ============ TABELA reviews ============
CREATE TABLE IF NOT EXISTS "reviews" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "unitId" UUID NOT NULL REFERENCES "units"("id") ON DELETE CASCADE,
  "profileId" UUID NOT NULL REFERENCES "review_sync_profiles"("id") ON DELETE CASCADE,
  "platform" "ReviewPlatform" NOT NULL,
  "externalId" VARCHAR NOT NULL,
  "authorName" VARCHAR,
  "authorAvatarUrl" VARCHAR,
  "rating" INTEGER NOT NULL,
  "title" VARCHAR,
  "content" TEXT,
  "sentiment" "ReviewSentiment" NOT NULL,
  "reviewedAt" TIMESTAMPTZ,
  "responseText" TEXT,
  "responseAt" TIMESTAMPTZ,
  "language" VARCHAR,
  "tags" JSONB,
  "metadata" JSONB,
  "fetchedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "reviews_tenantId_profileId_externalId_key"
  ON "reviews" ("tenantId", "profileId", "externalId");

CREATE INDEX IF NOT EXISTS "reviews_tenantId_unitId_fetchedAt_idx"
  ON "reviews" ("tenantId", "unitId", "fetchedAt");

CREATE INDEX IF NOT EXISTS "reviews_tenantId_platform_sentiment_idx"
  ON "reviews" ("tenantId", "platform", "sentiment");


-- ============ FK em feedback_cases (1:1 opcional) ============
ALTER TABLE "feedback_cases"
  ADD COLUMN IF NOT EXISTS "reviewId" UUID REFERENCES "reviews"("id") ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "feedback_cases_reviewId_key"
  ON "feedback_cases" ("reviewId");

-- Trigger de updatedAt para as novas tabelas
CREATE OR REPLACE FUNCTION set_updated_at_review()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_review_sync_profiles_updated_at ON "review_sync_profiles";
CREATE TRIGGER trg_review_sync_profiles_updated_at
BEFORE UPDATE ON "review_sync_profiles"
FOR EACH ROW EXECUTE FUNCTION set_updated_at_review();

DROP TRIGGER IF EXISTS trg_reviews_updated_at ON "reviews";
CREATE TRIGGER trg_reviews_updated_at
BEFORE UPDATE ON "reviews"
FOR EACH ROW EXECUTE FUNCTION set_updated_at_review();
