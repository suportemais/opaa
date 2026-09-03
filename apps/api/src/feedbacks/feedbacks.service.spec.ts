import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { FeedbacksService } from './feedbacks.service';
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

function serviceWithFindMany(findMany: jest.Mock) {
  return new FeedbacksService(
    { surveyResponse: { findMany } } as never,
    {} as never,
  );
}

function whereOf(findMany: jest.Mock): Record<string, unknown> {
  const calls = findMany.mock.calls as unknown as Array<
    [{ where: Record<string, unknown> }]
  >;
  return calls[0][0].where;
}

function andFilters(where: Record<string, unknown>) {
  return (where.AND as Array<Record<string, unknown>>) ?? [];
}

describe('FeedbacksService.list sentiment filters', () => {
  it('filters classified elogio responses for the current tenant', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const svc = serviceWithFindMany(findMany);

    await svc.list(user(), {
      sentiment: 'elogio',
      from: '2026-08-01',
      to: '2026-08-31',
    });

    const where = whereOf(findMany);
    expect(where.tenantId).toBe('tenant-a');
    expect(where.status).toBe('completed');
    expect(andFilters(where)).toEqual(
      expect.arrayContaining([{ sentiment: 'elogio' }]),
    );
  });

  it('filters by theme and still applies the date range', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const svc = serviceWithFindMany(findMany);

    await svc.list(user(), {
      theme: 'espera',
      from: '2026-08-01',
      to: '2026-08-31',
    });

    const where = whereOf(findMany);
    const extras = andFilters(where);
    expect(extras).toEqual(
      expect.arrayContaining([{ sentimentTheme: 'espera' }]),
    );
    expect(extras.some((item) => item.completedAt)).toBe(true);
  });

  it('accepts sentimentTheme as an alias of theme', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const svc = serviceWithFindMany(findMany);

    await svc.list(user(), { sentimentTheme: 'atendimento' });

    expect(andFilters(whereOf(findMany))).toEqual(
      expect.arrayContaining([{ sentimentTheme: 'atendimento' }]),
    );
  });

  it('combines sentiment slice with a theme bar', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const svc = serviceWithFindMany(findMany);

    await svc.list(user(), {
      sentiment: 'reclamacao',
      theme: 'comida',
    });

    expect(andFilters(whereOf(findMany))).toEqual(
      expect.arrayContaining([
        { sentiment: 'reclamacao' },
        { sentimentTheme: 'comida' },
      ]),
    );
  });

  it('maps outro to classified rows with null or outro theme', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const svc = serviceWithFindMany(findMany);

    await svc.list(user(), { theme: 'outro' });

    expect(andFilters(whereOf(findMany))).toEqual(
      expect.arrayContaining([
        {
          OR: [
            { sentimentTheme: 'outro' },
            { sentimentTheme: null, sentiment: { not: null } },
          ],
        },
      ]),
    );
  });

  it('keeps npsClass filtering when sentiment is absent', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const svc = serviceWithFindMany(findMany);

    await svc.list(user(), { npsClass: 'promoter' });

    expect(andFilters(whereOf(findMany))).toEqual(
      expect.arrayContaining([{ npsClass: 'promoter' }]),
    );
  });

  it('does not overwrite unit-scope OR when filtering outro', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const svc = serviceWithFindMany(findMany);

    await svc.list(
      user({
        permissionCodes: [PermissionCodes.ResponseRead],
        unitIds: ['unit-1'],
      }),
      { theme: 'outro' },
    );

    const where = whereOf(findMany);
    expect(where.OR).toEqual([
      { unitId: { in: ['unit-1'] } },
      { unitId: null },
    ]);
    expect(andFilters(where).some((item) => Array.isArray(item.OR))).toBe(true);
  });

  it('rejects an unknown sentiment', () => {
    const svc = serviceWithFindMany(jest.fn());
    expect(() => svc.list(user(), { sentiment: 'positive' })).toThrow(
      BadRequestException,
    );
  });

  it('rejects a unit outside the user scope', () => {
    const svc = serviceWithFindMany(jest.fn());
    expect(() =>
      svc.list(
        user({
          permissionCodes: [PermissionCodes.ResponseRead],
          unitIds: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
        }),
        { unitId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', sentiment: 'elogio' },
      ),
    ).toThrow(ForbiddenException);
  });
});
