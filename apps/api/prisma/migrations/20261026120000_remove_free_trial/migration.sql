-- Sem teste grátis: planos novos e existentes passam a ter 0 dias de teste.
ALTER TABLE "plans" ALTER COLUMN "trialDays" SET DEFAULT 0;
UPDATE "plans" SET "trialDays" = 0;
