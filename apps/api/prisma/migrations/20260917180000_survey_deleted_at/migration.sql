-- Soft-delete surveys without dropping responses, versions, or distributions.

ALTER TABLE "surveys"
    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "surveys_tenantId_deletedAt_idx" ON "surveys"("tenantId", "deletedAt");
