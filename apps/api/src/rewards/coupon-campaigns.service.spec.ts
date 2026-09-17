import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CouponCampaignsService } from './coupon-campaigns.service';
import type { AuthUser } from '../auth/auth.types';
import { PermissionCodes } from '../rbac/permission-codes';

const UNIT_A = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  name: 'Unidade Centro',
  document: '33000167000101',
  legalName: 'Centro Alimentos LTDA',
};

const UNIT_B = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  name: 'Unidade Shopping',
  document: '00000000000191',
  legalName: 'Shopping Alimentos LTDA',
};

const TENANT_MATRIZ_CNPJ = '00360305000104';

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

function setup(opts?: { units?: (typeof UNIT_A)[] }) {
  const units = opts?.units ?? [UNIT_A];
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
    unitId: UNIT_A.id,
    issuerCnpj: UNIT_A.document,
    issuerLegalName: UNIT_A.legalName,
    issuerTradeName: UNIT_A.name,
    createdAt: new Date(),
    updatedAt: new Date(),
    survey: { id: 'survey-1', name: 'NPS loja' },
    unit: UNIT_A,
  };
  const prisma = {
    survey: {
      findFirst: jest.fn().mockResolvedValue({ id: 'survey-1' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    unit: {
      findMany: jest.fn().mockResolvedValue(units),
    },
    tenant: {
      findUnique: jest.fn().mockResolvedValue({
        document: TENANT_MATRIZ_CNPJ,
        legalName: 'Matriz LTDA',
        tradeName: 'Matriz',
      }),
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
            unit: created.unit,
          }),
        ),
    },
    coupon: {
      groupBy: jest
        .fn()
        .mockResolvedValueOnce([{ campaignId: 'camp-1', _count: { _all: 4 } }])
        .mockResolvedValueOnce([{ campaignId: 'camp-1', _count: { _all: 1 } }])
        .mockResolvedValue([]),
    },
    tenantMmIntegration: {
      findUnique: jest.fn().mockResolvedValue({ mmCompanyId: 'mm-co-1' }),
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
          unitId: UNIT_A.id,
          issuerCnpj: UNIT_A.document,
          issuerLegalName: UNIT_A.legalName,
          issuerTradeName: UNIT_A.name,
        }),
      }),
    );
    expect(row.issuer).toEqual({
      cnpj: UNIT_A.document,
      legalName: UNIT_A.legalName,
      tradeName: UNIT_A.name,
    });
    expect(row.cnpj).toBe(UNIT_A.document);
    expect(row.cnpj).not.toBe(TENANT_MATRIZ_CNPJ);
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
    expect(prisma.survey.updateMany).toHaveBeenCalledWith({
      where: { id: 'survey-1', tenantId: 'tenant-a' },
      data: { enableCoupon: true },
    });
    expect(row.perCustomerLimit).toBe(1);
    expect(row.issuedCount).toBe(4);
    expect(row.redeemedCount).toBe(1);
  });

  it('rejects create when the tenant is not linked', async () => {
    const { service, prisma } = setup();
    prisma.tenantMmIntegration.findUnique.mockResolvedValue(null);
    await expect(
      service.create(user(), {
        name: 'X',
        surveyId: 'survey-1',
        mmCompanyId: 'mm-co-1',
        rewardAmountCents: 100,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.couponCampaign.create).not.toHaveBeenCalled();
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

  it('auto-selects the only unit and snapshots its CNPJ (never tenant/matriz)', async () => {
    const { service, prisma } = setup();
    await service.create(user(), {
      name: 'Pós-pesquisa MM',
      surveyId: 'survey-1',
      mmCompanyId: 'mm-co-1',
      rewardAmountCents: 1500,
    });
    expect(prisma.couponCampaign.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          unitId: UNIT_A.id,
          issuerCnpj: UNIT_A.document,
        }),
      }),
    );
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
  });

  it('requires unitId when the tenant has multiple units', async () => {
    const { service, prisma } = setup({ units: [UNIT_A, UNIT_B] });
    await expect(
      service.create(user(), {
        name: 'X',
        surveyId: 'survey-1',
        mmCompanyId: 'mm-co-1',
        rewardAmountCents: 100,
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        constructor: BadRequestException,
        message: expect.stringMatching(/unit_required/),
      }),
    );
    expect(prisma.couponCampaign.create).not.toHaveBeenCalled();
  });

  it('snapshots unit A vs unit B with different issuer CNPJs', async () => {
    const { service, prisma } = setup({ units: [UNIT_A, UNIT_B] });
    await service.create(user(), {
      name: 'A',
      surveyId: 'survey-1',
      mmCompanyId: 'mm-co-1',
      rewardAmountCents: 100,
      unitId: UNIT_A.id,
    });
    await service.create(user(), {
      name: 'B',
      surveyId: 'survey-1',
      mmCompanyId: 'mm-co-1',
      rewardAmountCents: 100,
      unitId: UNIT_B.id,
    });
    const snaps = prisma.couponCampaign.create.mock.calls.map(
      (call) => call[0].data as { issuerCnpj: string; unitId: string },
    );
    expect(snaps.map((row) => row.issuerCnpj)).toEqual([
      UNIT_A.document,
      UNIT_B.document,
    ]);
    expect(snaps[0].issuerCnpj).not.toBe(snaps[1].issuerCnpj);
  });

  it('rejects create when the unit has no CNPJ', async () => {
    const { service, prisma } = setup({
      units: [{ ...UNIT_A, document: null as never }],
    });
    await expect(
      service.create(user(), {
        name: 'X',
        surveyId: 'survey-1',
        mmCompanyId: 'mm-co-1',
        rewardAmountCents: 100,
        unitId: UNIT_A.id,
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        constructor: BadRequestException,
        message: expect.stringMatching(/issuer_cnpj_required/),
      }),
    );
    expect(prisma.couponCampaign.create).not.toHaveBeenCalled();
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
  });

  it('rejects an unknown unitId', async () => {
    const { service } = setup({ units: [UNIT_A] });
    await expect(
      service.create(user(), {
        name: 'X',
        surveyId: 'survey-1',
        mmCompanyId: 'mm-co-1',
        rewardAmountCents: 100,
        unitId: UNIT_B.id,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
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
