import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('unit CNPJ adhesion voucher migration', () => {
  const sql = readFileSync(
    join(
      __dirname,
      '../../prisma/migrations/20260917210000_unit_cnpj_adhesion_voucher/migration.sql',
    ),
    'utf8',
  );

  it('is additive only (no destructive SQL)', () => {
    expect(sql).toMatch(
      /ALTER TABLE "units" ADD COLUMN IF NOT EXISTS "document"/,
    );
    expect(sql).toMatch(
      /ALTER TABLE "units" ADD COLUMN IF NOT EXISTS "legalName"/,
    );
    expect(sql).toMatch(
      /ALTER TABLE "mm_adhesion_vouchers" ADD COLUMN IF NOT EXISTS "unitId"/,
    );
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS "mm_adhesion_vouchers_unitId_idx"/,
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
