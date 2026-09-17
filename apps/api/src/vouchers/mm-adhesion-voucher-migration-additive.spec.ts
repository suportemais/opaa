import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('mm adhesion voucher migration', () => {
  const sql = readFileSync(
    join(
      __dirname,
      '../../prisma/migrations/20260917140000_mm_adhesion_voucher/migration.sql',
    ),
    'utf8',
  );

  it('is additive only (no destructive SQL)', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS "mm_adhesion_vouchers"/);
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "mm_adhesion_vouchers_code_key"/,
    );
    expect(sql).toMatch(/CREATE TYPE "MmAdhesionVoucherStatus"/);

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
