import {
  canonicalizeRewardPayload,
  isTimestampFresh,
  signRewardPayload,
  signVerifyRequest,
  verifyRewardSignature,
  verifyVerifyRequestSignature,
} from './hmac';

const secret = 'test-mm-secret';

const payload = {
  amountCents: 1500,
  campaignId: '11111111-1111-4111-8111-111111111111',
  code: 'MMABC12D',
  customerKey: 'phone:5511988887777',
  expiresAt: '2026-10-01T00:00:00.000Z',
  mmCompanyId: 'mm-company-1',
};

describe('reward HMAC', () => {
  it('signs a stable canonical payload', () => {
    const signature = signRewardPayload(payload, secret);
    expect(signature).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyRewardSignature(payload, signature, secret)).toBe(true);
    expect(verifyRewardSignature({ ...payload, amountCents: 1 }, signature, secret)).toBe(false);
    expect(canonicalizeRewardPayload(payload)).toBe(
      '{"amountCents":1500,"campaignId":"11111111-1111-4111-8111-111111111111","code":"MMABC12D","customerKey":"phone:5511988887777","expiresAt":"2026-10-01T00:00:00.000Z","mmCompanyId":"mm-company-1"}',
    );
  });

  it('signs verify requests as timestamp + canonical body', () => {
    const timestamp = '1726332840';
    const signature = signVerifyRequest({
      timestamp,
      body: { code: 'MMABC12D' },
      secret,
    });
    expect(
      verifyVerifyRequestSignature({
        timestamp,
        body: { code: 'MMABC12D' },
        signature,
        secret,
      }),
    ).toBe(true);
    expect(
      verifyVerifyRequestSignature({
        timestamp,
        body: { code: 'OTHER' },
        signature,
        secret,
      }),
    ).toBe(false);
  });

  it('rejects stale timestamps', () => {
    const now = Date.parse('2026-09-14T18:00:00.000Z');
    expect(isTimestampFresh('1726332840', now, 300)).toBe(false);
    expect(isTimestampFresh(String(Math.floor(now / 1000)), now, 300)).toBe(true);
  });
});
