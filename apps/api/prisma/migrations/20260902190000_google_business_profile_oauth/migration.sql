-- Additive, backward-compatible Google Business Profile OAuth + review alerts.
-- This migration only adds columns. Existing publicUrl, locationId (Place ID),
-- apiKeyEncrypted, reviews and sync history are preserved.

-- AlterTable review_sync_profiles
ALTER TABLE "review_sync_profiles"
  ADD COLUMN "googleAccountId" TEXT,
  ADD COLUMN "googleLocationId" TEXT,
  ADD COLUMN "googleLocationName" TEXT,
  ADD COLUMN "googleAccessTokenEnc" TEXT,
  ADD COLUMN "googleRefreshTokenEnc" TEXT,
  ADD COLUMN "googleTokenExpiresAt" TIMESTAMP(3),
  ADD COLUMN "googleConnectedAt" TIMESTAMP(3),
  ADD COLUMN "googleConnectedEmail" TEXT,
  ADD COLUMN "initialSyncCompletedAt" TIMESTAMP(3),
  ADD COLUMN "lastReviewUpdateTime" TIMESTAMP(3);

-- AlterTable reviews
ALTER TABLE "reviews"
  ADD COLUMN "notifiedAt" TIMESTAMP(3),
  ADD COLUMN "notifyError" TEXT;

-- AlterTable review_sync_executions
ALTER TABLE "review_sync_executions"
  ADD COLUMN "notificationsSent" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "notificationsFailed" INTEGER NOT NULL DEFAULT 0;
