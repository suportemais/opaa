import {
  isMmValidateKeyRejected,
  maskMmApiKey,
  mmApiKeyLast4,
  mmValidateKeyUrl,
  parseMmValidateKeyResponse,
} from './mm-validate-key';

describe('mm-validate-key contract', () => {
  it('builds the S2S URL from MM_API_BASE_URL', () => {
    expect(mmValidateKeyUrl('https://muitomais.app/api/')).toBe(
      'https://muitomais.app/api/internal/opiina/validate-key',
    );
  });

  it('parses the documented success body', () => {
    expect(
      parseMmValidateKeyResponse({
        ok: true,
        mmCompanyId: 'mm-company-gepos',
        tradeName: 'Grupo Geppos',
      }),
    ).toEqual({
      mmCompanyId: 'mm-company-gepos',
      tradeName: 'Grupo Geppos',
    });
  });

  it('parses a nested company object', () => {
    expect(
      parseMmValidateKeyResponse({
        company: { id: 'co-1', tradeName: 'Grupo Geppos' },
      }),
    ).toEqual({ mmCompanyId: 'co-1', tradeName: 'Grupo Geppos' });
  });

  it('masks only the last four characters', () => {
    expect(mmApiKeyLast4('  mm-live-key-abcd  ')).toBe('abcd');
    expect(maskMmApiKey('abcd')).toBe('••••abcd');
    expect(maskMmApiKey(null)).toBe('••••');
  });

  it('rejects invalid-key payloads', () => {
    expect(
      parseMmValidateKeyResponse({ ok: false, reason: 'invalid_key' }),
    ).toBe(null);
    expect(isMmValidateKeyRejected(401, {})).toBe(true);
    expect(isMmValidateKeyRejected(200, { ok: false })).toBe(true);
    expect(
      isMmValidateKeyRejected(200, { ok: true, mmCompanyId: 'co-1' }),
    ).toBe(false);
  });
});
