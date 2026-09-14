import { signRewardPayload } from '../domain/rewards/hmac';
import { RewardVerifyService } from './reward-verify.service';

const secret = 'test-mm-secret';
const expiresAt = new Date('2026-10-01T00:00:00.000Z');

function couponRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    code: 'MMABC12D',
    status: 'sent',
    amountCents: 1500,
    mmCompanyId: 'mm-co-1',
    customerKey: 'phone:5511988887777',
    expiresAt,
    campaignId: 'camp-1',
    cancelledAt: null,
    redeemedAt: null,
    ...overrides,
  };
}

function setup(row: Record<string, unknown> | null) {
  const findFirst = jest.fn().mockResolvedValue(row);
  const service = new RewardVerifyService(
    { coupon: { findFirst } } as never,
    {
      get: jest.fn((key: string) =>
        key === 'MM_REWARD_HMAC_SECRET' ? secret : undefined,
      ),
    } as never,
  );
  return { service, findFirst };
}

describe('RewardVerifyService', () => {
  it('returns a signed payload MM can verify independently', async () => {
    const { service } = setup(couponRow());
    const result = await service.verify({ code: 'MMABC12D' });
    expect(result.valid).toBe(true);
    expect(result.code).toBe('MMABC12D');
    expect(result.amountCents).toBe(1500);
    expect(result.mmCompanyId).toBe('mm-co-1');
    expect(result.customerKey).toBe('phone:5511988887777');
    expect(result.expiresAt).toBe(expiresAt.toISOString());
    expect(result.campaignId).toBe('camp-1');
    expect(result.signedPayload).toEqual({
      amountCents: 1500,
      campaignId: 'camp-1',
      code: 'MMABC12D',
      customerKey: 'phone:5511988887777',
      expiresAt: expiresAt.toISOString(),
      mmCompanyId: 'mm-co-1',
    });
    expect(result.signature).toBe(
      signRewardPayload(result.signedPayload!, secret),
    );
  });

  it('rejects unknown, expired and redeemed codes', async () => {
    const missing = setup(null);
    await expect(missing.service.verify({ code: 'NOPE' })).resolves.toEqual({
      valid: false,
      reason: 'not_found',
    });

    const expired = setup(
      couponRow({ expiresAt: new Date('2020-01-01T00:00:00.000Z') }),
    );
    await expect(
      expired.service.verify({ code: 'MMABC12D' }),
    ).resolves.toMatchObject({
      valid: false,
      reason: 'expired',
    });

    const redeemed = setup(
      couponRow({ status: 'redeemed', redeemedAt: new Date() }),
    );
    await expect(
      redeemed.service.verify({ code: 'MMABC12D' }),
    ).resolves.toMatchObject({
      valid: false,
      reason: 'redeemed',
    });
  });
});
