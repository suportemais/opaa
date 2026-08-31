-- Classification of survey responses (elogio / reclamacao / neutro)

DO $$ BEGIN
  CREATE TYPE "ResponseSentiment" AS ENUM ('elogio', 'reclamacao', 'neutro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SentimentSource" AS ENUM ('groq', 'score', 'skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "survey_responses"
  ADD COLUMN IF NOT EXISTS "sentiment" "ResponseSentiment",
  ADD COLUMN IF NOT EXISTS "sentimentTheme" TEXT,
  ADD COLUMN IF NOT EXISTS "sentimentSummary" TEXT,
  ADD COLUMN IF NOT EXISTS "sentimentSource" "SentimentSource",
  ADD COLUMN IF NOT EXISTS "sentimentClassifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "sentimentAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "sentimentLastError" TEXT,
  ADD COLUMN IF NOT EXISTS "sentimentNextAttemptAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "survey_responses_tenantId_completedAt_sentiment_idx"
  ON "survey_responses"("tenantId", "completedAt", "sentiment");

CREATE INDEX IF NOT EXISTS "survey_responses_status_sentiment_sentimentNextAttemptAt_idx"
  ON "survey_responses"("status", "sentiment", "sentimentNextAttemptAt");
