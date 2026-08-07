-- Enums
CREATE TYPE "WhistleblowerStatus" AS ENUM ('received', 'analyzing', 'investigating', 'awaiting_info', 'completed', 'archived');
CREATE TYPE "WhistleblowerPriority" AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE "WhistleblowerCategory" AS ENUM ('moral_harassment', 'sexual_harassment', 'discrimination', 'racism', 'fraud', 'corruption', 'conflict_of_interest', 'policy_violation', 'work_safety', 'lgpd_privacy', 'misconduct', 'other');

-- whistleblower_reports
CREATE TABLE "whistleblower_reports" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "unitId" UUID,
  "protocol" TEXT NOT NULL,
  "publicToken" TEXT NOT NULL,
  "category" "WhistleblowerCategory" NOT NULL,
  "customCategory" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3),
  "locationText" TEXT,
  "involvedPeople" TEXT,
  "witnesses" TEXT,
  "additionalInfo" TEXT,
  "status" "WhistleblowerStatus" NOT NULL DEFAULT 'received',
  "priority" "WhistleblowerPriority" NOT NULL DEFAULT 'medium',
  "reporterName" TEXT,
  "reporterEmail" TEXT,
  "reporterPhone" TEXT,
  "reporterDoc" TEXT,
  "reporterAnonymous" BOOLEAN NOT NULL DEFAULT true,
  "assigneeUserId" UUID,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "whistleblower_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "whistleblower_reports_protocol_key" ON "whistleblower_reports"("protocol");
CREATE UNIQUE INDEX "whistleblower_reports_publicToken_key" ON "whistleblower_reports"("publicToken");
CREATE UNIQUE INDEX "whistleblower_reports_tenantId_protocol_key" ON "whistleblower_reports"("tenantId", "protocol");
CREATE INDEX "whistleblower_reports_tenantId_status_createdAt_idx" ON "whistleblower_reports"("tenantId", "status", "createdAt" DESC);
CREATE INDEX "whistleblower_reports_tenantId_unitId_createdAt_idx" ON "whistleblower_reports"("tenantId", "unitId", "createdAt" DESC);
CREATE INDEX "whistleblower_reports_tenantId_priority_createdAt_idx" ON "whistleblower_reports"("tenantId", "priority", "createdAt" DESC);

ALTER TABLE "whistleblower_reports"
  ADD CONSTRAINT "whistleblower_reports_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "whistleblower_reports_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "whistleblower_reports_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- whistleblower_report_events
CREATE TABLE "whistleblower_report_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "reportId" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT,
  "notes" TEXT,
  "assigneeUserId" UUID,
  "createdById" UUID,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "whistleblower_report_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "whistleblower_report_events_tenantId_reportId_createdAt_idx" ON "whistleblower_report_events"("tenantId", "reportId", "createdAt" ASC);

ALTER TABLE "whistleblower_report_events"
  ADD CONSTRAINT "whistleblower_report_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "whistleblower_report_events_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "whistleblower_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "whistleblower_report_events_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "whistleblower_report_events_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
