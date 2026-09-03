-- Tenant-level Google OAuth connection.
-- Additive only: new table. Existing review_sync_profiles token columns stay in place.
-- Does not change locationId (Place ID) or publicUrl.

CREATE TABLE "google_oauth_connections" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "googleAccountId" TEXT,
    "googleAccessTokenEnc" TEXT,
    "googleRefreshTokenEnc" TEXT,
    "googleTokenExpiresAt" TIMESTAMP(3),
    "googleConnectedAt" TIMESTAMP(3),
    "googleConnectedEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_oauth_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "google_oauth_connections_tenantId_key" ON "google_oauth_connections"("tenantId");

ALTER TABLE "google_oauth_connections"
  ADD CONSTRAINT "google_oauth_connections_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
