-- Painel redesign: migração ADITIVA apenas (novas colunas anuláveis, novo valor de enum,
-- nova tabela e novos índices). Nenhum dado existente é alterado ou removido.

-- AlterEnum
ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'invited';

-- AlterTable: surveys
ALTER TABLE "surveys" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);
ALTER TABLE "surveys" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

-- AlterTable: customers
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "acceptsOffers" BOOLEAN;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "acceptsOffersAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "customer_consents_tenantId_customerId_purpose_grantedAt_idx"
  ON "customer_consents"("tenantId", "customerId", "purpose", "grantedAt");

-- CreateTable
CREATE TABLE IF NOT EXISTS "user_invite_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "user_invite_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_invite_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_invite_tokens_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "user_invite_tokens_tokenHash_key" ON "user_invite_tokens"("tokenHash");
CREATE INDEX IF NOT EXISTS "user_invite_tokens_userId_createdAt_idx" ON "user_invite_tokens"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "user_invite_tokens_tenantId_createdAt_idx" ON "user_invite_tokens"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "user_invite_tokens_expiresAt_idx" ON "user_invite_tokens"("expiresAt");
