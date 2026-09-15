import { BadRequestException } from '@nestjs/common';
import { CouponCampaignsService } from './coupon-campaigns.service';
import type { AuthUser } from '../auth/auth.types';
import { PermissionCodes } from '../rbac/permission-codes';

function user(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    userId: 'u1',
    tenantId: 'tenant-a',
    name: 'Ana',
    email: 'ana@example.com',
    phone: null,
    permissionCodes: [PermissionCodes.SurveyManage, PermissionCodes.SurveyRead],
    roleCodes: [],
    unitIds: [],
    ...overrides,
  };
}

function setup() {
  const created = {
    id: 'camp-1',
    tenantId: 'tenant-a',
    name: 'Pós-pesquisa MM',
    description: null,
    benefit: 'Muito Mais R$ 15,00',
    prefix: 'MM',
    startsAt: null,
    endsAt: null,
    totalLimit: null,
    perCustomerLimit: 1,
    status: 'active',
    message: 'Use {{code}}',
    surveyId: 'survey-1',
    mmCompanyId: 'mm-co-1',
    rewardEnabled: true,
    rewardAmountCents: 1500,
    validityDays: 30,
    createdAt: new Date(),
    updatedAt: new Date(),
    survey: { id: 'survey-1', name: 'NPS loja' },
  };
  const prisma = {
    survey: {
      findFirst: jest.fn().mockResolvedValue({ id: 'survey-1' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    couponCampaign: {
      findMany: jest.fn().mockResolvedValue([created]),
      findFirst: jest.fn().mockResolvedValue(created),
      create: jest.fn().mockResolvedValue(created),
      update: jest
        .fn()
        .mockImplementation(
          async ({ data }: { data: Record<string, unknown> }) => ({
            ...created,
            ...data,
            survey: created.survey,
          }),
        ),
    },
    coupon: {
      groupBy: jest
        .fn()
        .mockResolvedValueOnce([{ campaignId: 'camp-1', _count: { _all: 4 } }])
        .mockResolvedValueOnce([{ campaignId: 'camp-1', _count: { _all: 1 } }]),
    },
    tenantMmIntegration: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
  };
  return {
    service: new CouponCampaignsService(prisma as never),
    prisma,
    created,
  };
}

describe('CouponCampaignsService', () => {
  it('creates an active reward campaign with mmCompanyId and perCustomerLimit=1', async () => {
    const { service, prisma } = setup();
    const row = await service.create(user(), {
      name: 'Pós-pesquisa MM',
      surveyId: 'survey-1',
      mmCompanyId: 'mm-co-1',
      rewardAmountCents: 1500,
      validityDays: 30,
      message: 'Use {{code}}',
    });
    expect(prisma.couponCampaign.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-a',
          mmCompanyId: 'mm-co-1',
          rewardEnabled: true,
          perCustomerLimit: 1,
          rewardAmountCents: 1500,
          status: 'active',
          surveyId: 'survey-1',
        }),
      }),
    );
    expect(prisma.survey.updateMany).toHaveBeenCalledWith({
      where: { id: 'survey-1', tenantId: 'tenant-a' },
      data: { enableCoupon: true },
    });
    expect(row.perCustomerLimit).toBe(1);
    expect(row.issuedCount).toBe(4);
    expect(row.redeemedCount).toBe(1);
  });

  it('rejects create when mmCompanyId is not the linked company', async () => {
    const { service, prisma } = setup();
    prisma.tenantMmIntegration.findUnique.mockResolvedValue({
      mmCompanyId: 'mm-company-gepos',
    });
    await expect(
      service.create(user(), {
        name: 'X',
        surveyId: 'survey-1',
        mmCompanyId: 'other-co',
        rewardAmountCents: 100,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.couponCampaign.create).not.toHaveBeenCalled();
  });

  it('rejects create without a tenant survey', async () => {
    const { service, prisma } = setup();
    prisma.survey.findFirst.mockResolvedValue(null);
    await expect(
      service.create(user(), {
        name: 'X',
        surveyId: 'missing',
        mmCompanyId: 'mm-co-1',
        rewardAmountCents: 100,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.couponCampaign.create).not.toHaveBeenCalled();
  });

  it('pauses instead of deleting and keeps perCustomerLimit at 1', async () => {
    const { service, prisma } = setup();
    const paused = await service.pause(user(), 'camp-1');
    expect(paused.status).toBe('paused');
    expect(paused.perCustomerLimit).toBe(1);
    expect(prisma.couponCampaign.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'paused',
          perCustomerLimit: 1,
        }),
      }),
    );
  });
});
