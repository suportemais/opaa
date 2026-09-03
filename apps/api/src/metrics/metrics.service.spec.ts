import { ForbiddenException } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import type { AuthUser } from '../auth/auth.types';
import { PermissionCodes } from '../rbac/permission-codes';

function user(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    userId: 'u1',
    tenantId: 'tenant-a',
    name: 'Ana',
    email: 'ana@example.com',
    phone: null,
    permissionCodes: [PermissionCodes.UnitManage, PermissionCodes.ResponseRead],
    roleCodes: [],
    unitIds: [],
    ...overrides,
  };
}

describe('MetricsService sentimentSummary', () => {
  it('always filters by the current tenant', async () => {
    const findMany = jest.fn().mockResolvedValue([
      { sentiment: 'elogio', sentimentTheme: 'atendimento' },
      { sentiment: 'reclamacao', sentimentTheme: 'espera' },
    ]);
    const service = new MetricsService(
      { surveyResponse: { findMany } } as never,
      { isGroqConfigured: () => true } as never,
    );

    const result = await service.sentimentSummary(user(), {
      from: '2026-08-01',
      to: '2026-08-31',
    });

    expect(findMany).toHaveBeenCalledTimes(1);
    const calls = findMany.mock.calls as unknown as Array<
      [{ where: Record<string, unknown> }]
    >;
    const arg = calls[0][0];
    expect(arg.where.tenantId).toBe('tenant-a');
    expect(arg.where.status).toBe('completed');
    expect(result.counts).toEqual({ elogio: 1, reclamacao: 1, neutro: 0 });
    expect(result.percents.elogio).toBe(50);
    expect(result.groqConfigured).toBe(true);
  });

  it('applies the selected unit filter', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new MetricsService(
      { surveyResponse: { findMany } } as never,
      { isGroqConfigured: () => false } as never,
    );

    await service.sentimentSummary(user(), {
      from: '2026-08-01',
      to: '2026-08-31',
      unitId: '11111111-1111-4111-8111-111111111111',
    });

    const calls = findMany.mock.calls as unknown as Array<
      [{ where: Record<string, unknown> }]
    >;
    expect(calls[0][0].where.unitId).toBe(
      '11111111-1111-4111-8111-111111111111',
    );
  });

  it('rejects a unit outside the user scope', async () => {
    const service = new MetricsService(
      { surveyResponse: { findMany: jest.fn() } } as never,
      { isGroqConfigured: () => true } as never,
    );

    await expect(
      service.sentimentSummary(
        user({
          permissionCodes: [PermissionCodes.ResponseRead],
          unitIds: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
        }),
        { unitId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

function rankingPrisma() {
  return {
    unit: {
      findMany: jest.fn().mockResolvedValue([{ id: 'u1', name: 'Centro' }]),
    },
    surveyResponse: { findMany: jest.fn().mockResolvedValue([]) },
    feedbackCase: { findMany: jest.fn().mockResolvedValue([]) },
    review: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

describe('MetricsService ranking', () => {
  it('always scopes ranking summary queries to the current tenant', async () => {
    const prisma = rankingPrisma();
    const service = new MetricsService(
      prisma as never,
      { isGroqConfigured: () => true } as never,
    );

    const result = await service.rankingSummary(user(), {
      from: '2026-02-01',
      to: '2026-03-31',
    });

    expect(prisma.unit.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.surveyResponse.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.feedbackCase.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.review.findMany).toHaveBeenCalledTimes(1);

    const unitWhere = (
      prisma.unit.findMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
      }
    ).where;
    const responseWhere = (
      prisma.surveyResponse.findMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
      }
    ).where;
    const caseWhere = (
      prisma.feedbackCase.findMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
      }
    ).where;

    expect(unitWhere.tenantId).toBe('tenant-a');
    expect(responseWhere.tenantId).toBe('tenant-a');
    expect(responseWhere.status).toBe('completed');
    expect(caseWhere.tenantId).toBe('tenant-a');
    expect(result.units).toHaveLength(1);
    expect(result.units[0].unitName).toBe('Centro');
    expect(result.months).toBeUndefined();
  });

  it('does not load units outside a regional manager scope', async () => {
    const prisma = rankingPrisma();
    prisma.unit.findMany.mockResolvedValue([
      { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Minha' },
    ]);
    const service = new MetricsService(
      prisma as never,
      { isGroqConfigured: () => true } as never,
    );

    await service.rankingMonthly(
      user({
        permissionCodes: [PermissionCodes.ResponseRead],
        unitIds: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
      }),
      { from: '2026-02-01', to: '2026-03-31' },
    );

    const unitWhere = (
      prisma.unit.findMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
      }
    ).where;
    const responseWhere = (
      prisma.surveyResponse.findMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
      }
    ).where;

    expect(unitWhere).toEqual({
      tenantId: 'tenant-a',
      id: { in: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'] },
    });
    expect(responseWhere.OR).toEqual([
      { unitId: { in: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'] } },
      { unitId: null },
    ]);
    expect(responseWhere.unitId).toBeUndefined();
  });

  it('rejects ranking for a unit outside the user scope', async () => {
    const service = new MetricsService(
      rankingPrisma() as never,
      {
        isGroqConfigured: () => true,
      } as never,
    );

    await expect(
      service.rankingSummary(
        user({
          permissionCodes: [PermissionCodes.ResponseRead],
          unitIds: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
        }),
        { unitId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('applies the selected unitId to responses, cases and units', async () => {
    const prisma = rankingPrisma();
    const service = new MetricsService(
      prisma as never,
      { isGroqConfigured: () => true } as never,
    );
    const unitId = '11111111-1111-4111-8111-111111111111';

    await service.rankingSummary(user(), {
      from: '2026-02-01',
      to: '2026-03-31',
      unitId,
    });

    const unitWhere = (
      prisma.unit.findMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
      }
    ).where;
    const responseWhere = (
      prisma.surveyResponse.findMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
      }
    ).where;
    const caseWhere = (
      prisma.feedbackCase.findMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
      }
    ).where;

    expect(unitWhere.id).toBe(unitId);
    expect(responseWhere.unitId).toBe(unitId);
    expect(caseWhere.unitId).toBe(unitId);
  });
});
