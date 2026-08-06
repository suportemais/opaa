CREATE TABLE "webhook_outbox" (
  "id" UUID NOT NULL,
  "tenantId" UUID,
  "eventType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 10,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastError" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "webhook_outbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "webhook_outbox_status_nextAttemptAt_idx" ON "webhook_outbox"("status", "nextAttemptAt");
CREATE INDEX "webhook_outbox_tenantId_eventType_idx" ON "webhook_outbox"("tenantId", "eventType");
