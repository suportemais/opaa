DROP INDEX IF EXISTS "survey_responses_tenantId_idempotencyKey_key";
CREATE UNIQUE INDEX "survey_responses_tenantId_surveyId_idempotencyKey_key" ON "survey_responses"("tenantId", "surveyId", "idempotencyKey");

