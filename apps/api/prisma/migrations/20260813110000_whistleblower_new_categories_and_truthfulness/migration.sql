-- Novas categorias de denúncia e termo de veracidade
-- Criado em: 2026-08-13

ALTER TYPE "WhistleblowerCategory" ADD VALUE 'racial_injury';
ALTER TYPE "WhistleblowerCategory" ADD VALUE 'homophobia';
ALTER TYPE "WhistleblowerCategory" ADD VALUE 'transphobia';
ALTER TYPE "WhistleblowerCategory" ADD VALUE 'religious_intolerance';

ALTER TABLE "whistleblower_reports"
  ADD COLUMN "truthfulnessAgreement" boolean NOT NULL DEFAULT true;
