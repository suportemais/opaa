import { BadRequestException } from '@nestjs/common';
import { WhistleblowerService } from './whistleblower.service';
import type { AuthUser } from '../auth/auth.types';
import { PermissionCodes } from '../rbac/permission-codes';

function user(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    userId: 'u1',
    tenantId: 'tenant-a',
    name: 'Ana',
    email: 'ana@example.com',
    phone: null,
    permissionCodes: [
      PermissionCodes.UnitManage,
      PermissionCodes.WhistleblowerRead,
    ],
    roleCodes: [],
    unitIds: [],
    ...overrides,
  };
}

function whereOf(findMany: jest.Mock) {
  return (
    findMany.mock.calls[0] as Array<{ where: Record<string, unknown> }>
  )[0].where;
}

describe('WhistleblowerService.list status filter', () => {
  it('expands status=open to non-final statuses', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const svc = new WhistleblowerService({
      whistleblowerReport: { findMany },
    } as never);
    await svc.list(user(), { status: 'open' });
    expect(whereOf(findMany).status).toEqual({
      in: ['received', 'analyzing', 'investigating', 'awaiting_info'],
    });
  });

  it('accepts comma-separated statuses and keeps single status as before', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const svc = new WhistleblowerService({
      whistleblowerReport: { findMany },
    } as never);
    await svc.list(user(), { status: 'completed,archived' });
    expect(whereOf(findMany).status).toEqual({ in: ['completed', 'archived'] });

    const findMany2 = jest.fn().mockResolvedValue([]);
    const svc2 = new WhistleblowerService({
      whistleblowerReport: { findMany: findMany2 },
    } as never);
    await svc2.list(user(), { status: 'received' });
    expect(whereOf(findMany2).status).toBe('received');
  });

  it('rejects unknown statuses', () => {
    const svc = new WhistleblowerService({
      whistleblowerReport: { findMany: jest.fn() },
    } as never);
    expect(() => svc.list(user(), { status: 'received,foo' })).toThrow(
      BadRequestException,
    );
  });
});

describe('WhistleblowerService.summary', () => {
  it('returns the four counters scoped to the tenant', async () => {
    const count = jest.fn().mockImplementation((args: unknown) => args);
    const $transaction = jest.fn().mockResolvedValue([3, 2, 1, 4]);
    const svc = new WhistleblowerService({
      whistleblowerReport: { count },
      $transaction,
    } as never);
    const result = await svc.summary(user(), {});
    expect(result).toEqual({
      unitId: null,
      novas: 3,
      emAndamento: 2,
      altaCritica: 1,
      concluidas90d: 4,
    });
    const wheres = (
      count.mock.calls as Array<[{ where: Record<string, unknown> }]>
    ).map((c) => c[0].where);
    expect(wheres.every((w) => w.tenantId === 'tenant-a')).toBe(true);
  });
});
