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

    const result = await service.sentimentSummary(user(), { from: '2026-08-01', to: '2026-08-31' });

    expect(findMany).toHaveBeenCalledTimes(1);
    const arg = findMany.mock.calls[0][0] as { where: Record<string, unknown> };
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

    const arg = findMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(arg.where.unitId).toBe('11111111-1111-4111-8111-111111111111');
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
