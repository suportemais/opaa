CREATE TABLE "password_reset_tokens" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ip" TEXT,
  "userAgent" TEXT,

  CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "password_reset_tokens_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "password_reset_tokens_tokenHash_key" UNIQUE ("tokenHash")
);

CREATE INDEX "password_reset_tokens_user_id_created_at_idx" ON "password_reset_tokens"("userId", "createdAt" DESC);
CREATE INDEX "password_reset_tokens_tenant_id_created_at_idx" ON "password_reset_tokens"("tenantId", "createdAt" DESC);
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens"("expiresAt");
