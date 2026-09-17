-- Additive: mark Escolha única options that should trigger “Por quê?”.

ALTER TABLE "question_options"
    ADD COLUMN IF NOT EXISTS "negative" BOOLEAN NOT NULL DEFAULT false;
