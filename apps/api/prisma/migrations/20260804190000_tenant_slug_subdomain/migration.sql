ALTER TABLE "tenants" ADD COLUMN "slug" TEXT;

UPDATE "tenants"
SET "slug" = regexp_replace(
  lower(regexp_replace(coalesce("tradeName", 'tenant'), '[^a-zA-Z0-9]+', '-', 'g')),
  '(^-+|-+$)',
  '',
  'g'
);

UPDATE "tenants"
SET "slug" = 't' || substring("id"::text, 1, 8)
WHERE "slug" IS NULL OR "slug" = '';

UPDATE "tenants"
SET "slug" = "slug" || '-' || substring("id"::text, 1, 4);

ALTER TABLE "tenants" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");
