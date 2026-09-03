import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BillingMode, TenantStatus } from '@prisma/client';
import { PermissionCodes } from '../rbac/permission-codes';
import type { AuthUser } from '../auth/auth.types';
import { PlatformService } from './platform.service';

function actor(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    userId: 'op-1',
    tenantId: 'platform-tenant',
    name: 'Dev Mais',
    email: 'ops@devmais.local',
    phone: null,
    permissionCodes: [
      PermissionCodes.PlatformTenantManage,
      PermissionCodes.PlatformTenantRead,
    ],
    roleCodes: ['platform_admin'],
    unitIds: [],
    ...overrides,
  };
}

function accountRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 't-1',
    slug: 'demo-bistro',
    legalName: 'Demo LTDA',
    tradeName: 'Demo Bistrô',
    email: 'tenant@demo.local',
    status: TenantStatus.trial,
    billingMode: BillingMode.stripe,
    planId: 'plan-start',
    trialEndsAt: new Date('2026-09-20T00:00:00.000Z'),
    accessValidUntil: null,
    manualAccessReason: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    activatedAt: null,
    suspendedAt: null,
    cancelledAt: null,
    isPlatform: false,
    plan: { id: 'plan-start', name: 'Start', slug: 'start' },
    _count: { units: 2 },
    users: [
      {
        id: 'u-1',
        name: 'Ana',
        email: 'ana@demo.local',
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
        roles: [{ role: { code: 'tenant_admin' } }],
      },
    ],
    ...overrides,
  };
}

describe('PlatformService', () => {
  it('returns overview KPIs and never exposes raw query errors', async () => {
    const prisma = {
      tenant: {
        count: jest
          .fn()
          .mockResolvedValueOnce(4)
          .mockResolvedValueOnce(2)
          .mockResolvedValueOnce(0),
      },
      surveyResponse: { count: jest.fn().mockResolvedValue(17) },
    };
    const audit = { log: jest.fn() };
    const svc = new PlatformService(prisma as never, audit as never);

    const result = await svc.overview({});
    expect(result.kpis).toEqual({
      activeAccounts: 4,
      trialAccounts: 2,
      pastDueAccounts: 0,
      pastDueAvailable: true,
      npsResponses: 17,
    });
    expect(prisma.tenant.count).toHaveBeenCalledWith({
      where: { isPlatform: false, status: TenantStatus.active },
    });
  });

  it('lists accounts with plan, status, units, owner and source label', async () => {
    const prisma = {
      tenant: { findMany: jest.fn().mockResolvedValue([accountRow()]) },
    };
    const svc = new PlatformService(
      prisma as never,
      { log: jest.fn() } as never,
    );
    const rows = await svc.listAccounts({});
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      tradeName: 'Demo Bistrô',
      status: 'trial',
      billingMode: 'stripe',
      sourceLabel: 'Stripe',
      unitsCount: 2,
      owner: { email: 'ana@demo.local' },
      plan: { slug: 'start' },
    });
  });

  it('grants manual access without Stripe and labels the subscription as Manual · DevMais', async () => {
    const update = jest.fn().mockResolvedValue({});
    const log = jest.fn();
    const prisma = {
      tenant: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            id: 't-1',
            status: TenantStatus.trial,
            trialEndsAt: null,
            activatedAt: null,
            billingMode: BillingMode.stripe,
          })
          .mockResolvedValueOnce(
            accountRow({
              billingMode: BillingMode.manual,
              status: TenantStatus.active,
              manualAccessReason: 'cortesia',
              accessValidUntil: null,
            }),
          ),
        update,
      },
      plan: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'plan-pro',
          name: 'Pro',
          slug: 'pro',
          trialDays: 14,
        }),
      },
    };
    const svc = new PlatformService(prisma as never, { log } as never);

    const account = await svc.grantAccess(actor(), 't-1', {
      planId: 'plan-pro',
      accessValidUntil: null,
      reason: 'cortesia',
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: 't-1' },
      data: expect.objectContaining({
        billingMode: BillingMode.manual,
        planId: 'plan-pro',
        accessValidUntil: null,
        manualAccessReason: 'cortesia',
        status: TenantStatus.active,
        suspendedAt: null,
      }),
    });
    expect(account.sourceLabel).toBe('Manual · DevMais');
    expect(account.billingMode).toBe('manual');
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'platform.account.grant_access' }),
    );
  });

  it('rejects grant access with an invalid validity date', async () => {
    const prisma = {
      tenant: {
        findFirst: jest.fn().mockResolvedValue({
          id: 't-1',
          status: TenantStatus.trial,
          trialEndsAt: null,
          activatedAt: null,
          billingMode: BillingMode.stripe,
        }),
        update: jest.fn(),
      },
      plan: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'plan-pro',
          name: 'Pro',
          slug: 'pro',
          trialDays: 14,
        }),
      },
    };
    const svc = new PlatformService(
      prisma as never,
      { log: jest.fn() } as never,
    );
    await expect(
      svc.grantAccess(actor(), 't-1', {
        planId: 'plan-pro',
        accessValidUntil: 'not-a-date',
        reason: 'manual',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });

  it('extends trial from the later of now or current trial end', async () => {
    const future = new Date('2026-10-01T00:00:00.000Z');
    const update = jest.fn().mockResolvedValue({});
    const prisma = {
      tenant: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            id: 't-1',
            status: TenantStatus.trial,
            trialEndsAt: future,
            activatedAt: null,
            billingMode: BillingMode.stripe,
          })
          .mockResolvedValueOnce(
            accountRow({ trialEndsAt: new Date('2026-10-15T00:00:00.000Z') }),
          ),
        update,
      },
    };
    const svc = new PlatformService(
      prisma as never,
      { log: jest.fn() } as never,
    );
    await svc.extendTrial(actor(), 't-1', { days: 14 });
    const data = update.mock.calls[0][0].data as {
      trialEndsAt: Date;
      status: TenantStatus;
    };
    expect(data.status).toBe(TenantStatus.trial);
    expect(data.trialEndsAt.toISOString()).toBe('2026-10-15T00:00:00.000Z');
  });

  it('lists subscriptions as read-only Stripe vs Manual · DevMais rows', async () => {
    const prisma = {
      tenant: {
        findMany: jest.fn().mockResolvedValue([
          accountRow(),
          accountRow({
            id: 't-2',
            slug: 'rede-x',
            tradeName: 'Rede X',
            billingMode: BillingMode.manual,
            status: TenantStatus.active,
          }),
        ]),
      },
    };
    const svc = new PlatformService(
      prisma as never,
      { log: jest.fn() } as never,
    );
    const rows = await svc.listSubscriptions();
    expect(rows.map((r) => r.sourceLabel)).toEqual([
      'Stripe',
      'Manual · DevMais',
    ]);
    expect(rows[1].source).toBe('manual');
  });

  it('throws when the account does not exist', async () => {
    const prisma = { tenant: { findFirst: jest.fn().mockResolvedValue(null) } };
    const svc = new PlatformService(
      prisma as never,
      { log: jest.fn() } as never,
    );
    await expect(
      svc.getAccount('00000000-0000-4000-8000-000000000001'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
