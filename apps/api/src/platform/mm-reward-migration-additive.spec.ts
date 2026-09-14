import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('mm reward emit migration', () => {
  const sql = readFileSync(
    join(
      __dirname,
      '../../prisma/migrations/20260914180000_mm_reward_emit/migration.sql',
    ),
    'utf8',
  );

  it('is additive only (no destructive SQL)', () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS "mmCompanyId"/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS "rewardAmountCents"/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS "rewardEnabled"/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS "customerKey"/);
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "coupons_campaignId_customerKey_key"/,
    );
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS "surveyId"/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS "documentNormalized"/);

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
