-- AlterEnum
CREATE TYPE "ReviewSyncRunStatus" AS ENUM ('never', 'syncing', 'success', 'partial', 'error', 'not_configured', 'not_implemented');

-- AlterTable
ALTER TABLE "review_sync_profiles"
  ADD COLUMN "lastSyncAttemptAt" TIMESTAMP(3),
  ADD COLUMN "lastSuccessfulSyncAt" TIMESTAMP(3),
  ADD COLUMN "lastSyncStatus" "ReviewSyncRunStatus" NOT NULL DEFAULT 'never',
  ADD COLUMN "lastSyncErrorCode" TEXT,
  ADD COLUMN "lastSyncHttpStatus" INTEGER;

-- AlterTable
ALTER TABLE "reviews"
  ADD COLUMN "reviewUrl" TEXT;

CREATE INDEX "reviews_tenantId_unitId_reviewedAt_idx" ON "reviews"("tenantId", "unitId", "reviewedAt");

-- CreateTable
CREATE TABLE "review_sync_executions" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "platform" "ReviewPlatform" NOT NULL,
    "origin" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "status" "ReviewSyncRunStatus" NOT NULL,
    "receivedCount" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "ignoredCount" INTEGER NOT NULL DEFAULT 0,
    "httpStatus" INTEGER,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "externalLocationId" TEXT,
    "metadata" JSONB,

    CONSTRAINT "review_sync_executions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "review_sync_executions_tenantId_platform_startedAt_idx" ON "review_sync_executions"("tenantId", "platform", "startedAt");
CREATE INDEX "review_sync_executions_profileId_startedAt_idx" ON "review_sync_executions"("profileId", "startedAt");

ALTER TABLE "review_sync_executions" ADD CONSTRAINT "review_sync_executions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "review_sync_executions" ADD CONSTRAINT "review_sync_executions_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "review_sync_executions" ADD CONSTRAINT "review_sync_executions_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "review_sync_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
