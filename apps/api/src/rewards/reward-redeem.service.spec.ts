import { RewardRedeemService } from './reward-redeem.service';

const expiresAt = new Date('2026-10-01T00:00:00.000Z');

function couponRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    tenantId: 'tenant-a',
    campaignId: 'camp-1',
    code: 'MMABC12D',
    status: 'sent',
    amountCents: 1500,
    mmCompanyId: 'mm-company-gepos',
    customerKey: 'phone:5511988887777',
    customerId: 'cust-1',
    cancelledAt: null,
    redeemedAt: null,
    expiresAt,
    unitId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    issuerCnpj: '33000167000101',
    issuerLegalName: 'Centro Alimentos LTDA',
    issuerTradeName: 'Unidade Centro',
    ...overrides,
  };
}

function setup(row: Record<string, unknown> | null) {
  const findFirst = jest.fn().mockResolvedValue(row);
  const update = jest.fn().mockResolvedValue(row);
  const create = jest.fn().mockResolvedValue({ id: 'red-1' });
  const tx = {
    coupon: { update },
    couponRedemption: { create },
  };
  const prisma = {
    coupon: { findFirst },
    $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
  };
  return {
    service: new RewardRedeemService(prisma as never),
    prisma,
    findFirst,
    update,
    create,
  };
}

describe('RewardRedeemService', () => {
  it('marks the coupon redeemed and writes a redemption row for KPI', async () => {
    const { service, prisma, update, create } = setup(couponRow());
    const result = await service.markRedeemed({ code: 'MMABC12D' });
    expect(result).toMatchObject({
      ok: true,
      code: 'MMABC12D',
      status: 'redeemed',
      amount: '15.00',
      amountCents: 1500,
      mmCompanyId: 'mm-company-gepos',
      campaignId: 'camp-1',
      cnpj: '33000167000101',
      unitId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      issuer: {
        cnpj: '33000167000101',
        legalName: 'Centro Alimentos LTDA',
        tradeName: 'Unidade Centro',
      },
    });
    if (result.ok) {
      expect(result.redeemedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: expect.objectContaining({ status: 'redeemed' }),
    });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-a',
        couponId: 'c1',
        customerId: 'cust-1',
        unitId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        metadata: { source: 'mm', cnpj: '33000167000101' },
      }),
    });
  });

  it('does not rewrite an already redeemed coupon', async () => {
    const { service, prisma } = setup(
      couponRow({ status: 'redeemed', redeemedAt: new Date() }),
    );
    await expect(service.markRedeemed({ code: 'MMABC12D' })).resolves.toEqual({
      ok: false,
      reason: 'redeemed',
      code: 'MMABC12D',
      campaignId: 'camp-1',
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects unknown, expired and company-mismatched codes', async () => {
    const missing = setup(null);
    await expect(
      missing.service.markRedeemed({ code: 'NOPE' }),
    ).resolves.toEqual({
      ok: false,
      reason: 'not_found',
    });

    const expired = setup(
      couponRow({ expiresAt: new Date('2020-01-01T00:00:00.000Z') }),
    );
    await expect(
      expired.service.markRedeemed({ code: 'MMABC12D' }),
    ).resolves.toMatchObject({ ok: false, reason: 'expired' });

    const mismatch = setup(couponRow());
    mismatch.findFirst.mockResolvedValue(null);
    await expect(
      mismatch.service.markRedeemed({
        code: 'MMABC12D',
        mmCompanyId: 'other-co',
      }),
    ).resolves.toEqual({ ok: false, reason: 'not_found' });
  });
});
