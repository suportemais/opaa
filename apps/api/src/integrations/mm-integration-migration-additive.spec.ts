import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('tenant MM integration migration', () => {
  const sql = readFileSync(
    join(
      __dirname,
      '../../prisma/migrations/20260915160000_tenant_mm_integration/migration.sql',
    ),
    'utf8',
  );

  it('is additive only (no destructive SQL)', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS "tenant_mm_integrations"/);
    expect(sql).toMatch(/"apiKeyEncrypted" TEXT NOT NULL/);
    expect(sql).toMatch(/"mmCompanyId" TEXT NOT NULL/);
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "tenant_mm_integrations_tenantId_key"/,
    );

    const forbidden = sql
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('--'))
      .join('\n')
      .replace(/\bON DELETE CASCADE\b/gi, '')
      .replace(/\bON UPDATE CASCADE\b/gi, '');

    expect(forbidden).not.toMatch(/\bDROP\b/i);
    expect(forbidden).not.toMatch(/\bDELETE\b/i);
    expect(forbidden).not.toMatch(/\bTRUNCATE\b/i);
    expect(forbidden).not.toMatch(/\bdeleteMany\b/i);
  });
});
