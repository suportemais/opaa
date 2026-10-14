import {
  marketingOffersConsentData,
  parseBirthDate,
  parseYesNo,
} from './offers';

describe('parseBirthDate', () => {
  it('accepts ISO and Brazilian formats', () => {
    expect(parseBirthDate('1990-05-20')?.toISOString()).toBe(
      '1990-05-20T00:00:00.000Z',
    );
    expect(parseBirthDate('20/05/1990')?.toISOString()).toBe(
      '1990-05-20T00:00:00.000Z',
    );
    expect(parseBirthDate('5/1/2001')?.toISOString()).toBe(
      '2001-01-05T00:00:00.000Z',
    );
  });

  it('rejects invalid or empty dates', () => {
    expect(parseBirthDate('')).toBeNull();
    expect(parseBirthDate(undefined)).toBeNull();
    expect(parseBirthDate('31/02/1990')).toBeNull();
    expect(parseBirthDate('1990/05/20')).toBeNull();
    expect(parseBirthDate('20/05/2999')).toBeNull();
  });
});

describe('parseYesNo', () => {
  it('maps sim/não variants', () => {
    expect(parseYesNo('Sim')).toBe(true);
    expect(parseYesNo('NÃO')).toBe(false);
    expect(parseYesNo('nao')).toBe(false);
    expect(parseYesNo('')).toBeNull();
    expect(parseYesNo('talvez')).toBeNull();
  });
});

describe('marketingOffersConsentData', () => {
  it('builds a granted/denied consent row', () => {
    const at = new Date('2026-10-01T00:00:00Z');
    expect(
      marketingOffersConsentData({
        tenantId: 't',
        customerId: 'c',
        granted: false,
        source: 'manual',
        at,
      }),
    ).toMatchObject({
      purpose: 'marketing_offers',
      status: 'denied',
      source: 'manual',
      grantedAt: at,
    });
  });
});
