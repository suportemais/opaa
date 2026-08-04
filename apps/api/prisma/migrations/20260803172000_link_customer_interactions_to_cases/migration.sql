-- AlterTable
ALTER TABLE "customer_interactions"
ADD COLUMN     "feedbackCaseId" UUID;

-- CreateIndex
CREATE INDEX "customer_interactions_tenantId_feedbackCaseId_idx" ON "customer_interactions"("tenantId", "feedbackCaseId");

-- AddForeignKey
ALTER TABLE "customer_interactions" ADD CONSTRAINT "customer_interactions_feedbackCaseId_fkey" FOREIGN KEY ("feedbackCaseId") REFERENCES "feedback_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

