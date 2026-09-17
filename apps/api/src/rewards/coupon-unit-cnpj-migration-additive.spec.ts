import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('coupon unit CNPJ migration', () => {
  const sql = readFileSync(
    join(
      __dirname,
      '../../prisma/migrations/20260917220000_coupon_unit_cnpj/migration.sql',
    ),
    'utf8',
  );

  it('is additive only (no destructive SQL)', () => {
    expect(sql).toMatch(
      /ALTER TABLE "coupon_campaigns" ADD COLUMN IF NOT EXISTS "unitId"/,
    );
    expect(sql).toMatch(
      /ALTER TABLE "coupon_campaigns" ADD COLUMN IF NOT EXISTS "issuerCnpj"/,
    );
    expect(sql).toMatch(
      /ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "unitId"/,
    );
    expect(sql).toMatch(
      /ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "issuerCnpj"/,
    );

    const forbidden = sql
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('--'))
      .join('\n')
      .replace(/\bON DELETE SET NULL\b/gi, '')
      .replace(/\bON UPDATE CASCADE\b/gi, '')
      .replace(/\bON DELETE CASCADE\b/gi, '');

    expect(forbidden).not.toMatch(/\bDROP\b/i);
    expect(forbidden).not.toMatch(/\bDELETE\b/i);
    expect(forbidden).not.toMatch(/\bTRUNCATE\b/i);
    expect(forbidden).not.toMatch(/\bdeleteMany\b/i);
  });
});
