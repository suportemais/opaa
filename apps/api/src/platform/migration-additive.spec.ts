import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('platform admin billing migration', () => {
  const sql = readFileSync(
    join(
      __dirname,
      '../../prisma/migrations/20260903220000_platform_admin_billing/migration.sql',
    ),
    'utf8',
  );

  it('is additive only (no destructive SQL)', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS "plans"/);
    expect(sql).toMatch(
      /ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "billingMode"/,
    );
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "roles_global_code_key"/,
    );

    const forbidden = sql
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('--'))
      .join('\n')
      .replace(/\bON DELETE SET NULL\b/gi, '')
      .replace(/\bON UPDATE CASCADE\b/gi, '');

    expect(forbidden).not.toMatch(/\bDROP\b/i);
    expect(forbidden).not.toMatch(/\bDELETE\b/i);
    expect(forbidden).not.toMatch(/\bTRUNCATE\b/i);
    expect(forbidden).not.toMatch(/\bdeleteMany\b/i);
  });
});
