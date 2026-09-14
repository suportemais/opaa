import { Prisma } from '@prisma/client';
import { RewardEmitService, REWARD_WHATSAPP_EVENT_TYPE } from './reward-emit.service';

const CAMPAIGN_ID = '22222222-2222-4222-8222-222222222222';
const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const SURVEY_ID = '33333333-3333-4333-8333-333333333333';

function campaignRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CAMPAIGN_ID,
    prefix: 'MM',
    message: 'Código {{code}} — {{link}} ({{amount}})',
    mmCompanyId: 'mm-co-1',
    rewardAmountCents: 1500,
    validityDays: 30,
    endsAt: null,
    totalLimit: null,
    ...overrides,
  };
}

function setup(opts?: {
  existing?: { id: string; code: string } | null;
  createImpl?: jest.Mock;
}) {
  const couponStore: Array<{ id: string; code: string; customerKey: string }> = [];
  const findUnique = jest.fn().mockImplementation(async ({ where }: { where: { campaignId_customerKey?: { customerKey: string } } }) => {
    if (opts?.existing) return opts.existing;
    const key = where.campaignId_customerKey?.customerKey;
    return couponStore.find((row) => row.customerKey === key) ?? null;
  });
  const create =
    opts?.createImpl ??
    jest.fn().mockImplementation(async ({ data }: { data: { code: string; customerKey: string } }) => {
      const row = {
        id: `coupon-${couponStore.length + 1}`,
        code: data.code,
        customerKey: data.customerKey,
        amountCents: 1500,
        mmCompanyId: 'mm-co-1',
        expiresAt: new Date('2026-10-14T00:00:00.000Z'),
      };
      couponStore.push(row);
      return row;
    });
  const update = jest.fn().mockResolvedValue({});
  const count = jest.fn().mockResolvedValue(0);
  const prisma = {
    survey: { findFirst: jest.fn().mockResolvedValue({ id: SURVEY_ID }) },
    couponCampaign: { findFirst: jest.fn().mockResolvedValue(campaignRow()) },
    coupon: { findUnique, create, update, count },
  };
  const enqueue = jest.fn().mockResolvedValue({ id: 'outbox-1' });
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'MM_REWARD_HMAC_SECRET') return 'test-mm-secret';
      if (key === 'MM_APP_BASE_URL') return 'https://app.muitomais.example';
      return undefined;
    }),
  };
  const service = new RewardEmitService(
    prisma as never,
    { enqueue } as never,
    config as never,
  );
  return { service, prisma, enqueue, create, findUnique, couponStore };
}

describe('RewardEmitService', () => {
  const input = {
    tenantId: TENANT_ID,
    surveyId: SURVEY_ID,
    surveyResponseId: '44444444-4444-4444-8444-444444444444',
    customerId: '55555555-5555-4555-8555-555555555555',
    identity: { phone: '11988887777' },
  };

  it('issues one code and enqueues WhatsApp with /app?voucher=CODE', async () => {
    const { service, create, enqueue } = setup();
    const first = await service.emitForCompletedResponse(input);
    expect(first.status).toBe('issued');
    expect(create).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledTimes(1);
    const event = enqueue.mock.calls[0][0] as {
      eventType: string;
      payload: { deepLink: string; to: string; signedPayload: { customerKey: string } };
    };
    expect(event.eventType).toBe(REWARD_WHATSAPP_EVENT_TYPE);
    expect(event.payload.to).toBe('5511988887777');
    expect(event.payload.deepLink).toMatch(/^https:\/\/app\.muitomais\.example\/app\?voucher=/);
    expect(event.payload.signedPayload.customerKey).toBe('phone:5511988887777');
  });

  it('does not create another code on a second completion for the same customerKey', async () => {
    const { service, create, enqueue } = setup();
    const first = await service.emitForCompletedResponse(input);
    const second = await service.emitForCompletedResponse({
      ...input,
      surveyResponseId: '66666666-6666-4666-8666-666666666666',
    });
    expect(first.status).toBe('issued');
    expect(second.status).toBe('already_issued');
    if (first.status === 'issued' && second.status === 'already_issued') {
      expect(second.code).toBe(first.code);
      expect(second.customerKey).toBe(first.customerKey);
    }
    expect(create).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it('treats a unique race as already issued', async () => {
    const create = jest.fn().mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['campaignId', 'customerKey'] },
      }),
    );
    const { service, enqueue } = setup({
      createImpl: create,
    });
    // After the failed create, findUnique returns the winner.
    const { prisma } = setup({ existing: { id: 'winner', code: 'MMEXIST01' } });
    const raced = new RewardEmitService(
      {
        ...prisma,
        coupon: {
          ...prisma.coupon,
          create,
          findUnique: jest
            .fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ id: 'winner', code: 'MMEXIST01' }),
        },
      } as never,
      { enqueue } as never,
      {
        get: jest.fn((key: string) => (key === 'MM_REWARD_HMAC_SECRET' ? 'test-mm-secret' : '')),
      } as never,
    );

    const result = await raced.emitForCompletedResponse(input);
    expect(result).toEqual({
      status: 'already_issued',
      couponId: 'winner',
      code: 'MMEXIST01',
      customerKey: 'phone:5511988887777',
    });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('issues a second code when the customerKey is different', async () => {
    const { service, create, enqueue } = setup();
    const first = await service.emitForCompletedResponse(input);
    const second = await service.emitForCompletedResponse({
      ...input,
      surveyResponseId: '77777777-7777-4777-8777-777777777777',
      identity: { phone: '11977776666' },
    });
    expect(first.status).toBe('issued');
    expect(second.status).toBe('issued');
    if (first.status === 'issued' && second.status === 'issued') {
      expect(second.code).not.toBe(first.code);
      expect(second.customerKey).toBe('phone:5511977776666');
    }
    expect(create).toHaveBeenCalledTimes(2);
    expect(enqueue).toHaveBeenCalledTimes(2);
  });

  it('skips when the survey has no active reward campaign', async () => {
    const { service, prisma, create } = setup();
    prisma.couponCampaign.findFirst.mockResolvedValue(null);
    await expect(service.emitForCompletedResponse(input)).resolves.toEqual({
      status: 'skipped',
      reason: 'no_eligible_campaign',
    });
    expect(create).not.toHaveBeenCalled();
  });
});
