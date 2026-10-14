import { PermissionCodes } from '../rbac/permission-codes';
import type { AuthUser } from '../auth/auth.types';
import { SurveysService } from './surveys.service';

function user(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    userId: 'u1',
    tenantId: 'tenant-a',
    name: 'Ana',
    email: 'ana@example.com',
    phone: null,
    permissionCodes: [PermissionCodes.UnitManage, PermissionCodes.SurveyManage],
    roleCodes: [],
    unitIds: [],
    ...overrides,
  };
}

function serviceWithPrisma(
  prisma: Record<string, unknown>,
  audit = { log: jest.fn() },
) {
  return {
    svc: new SurveysService(prisma as never, audit as never),
    audit,
  };
}

describe('SurveysService.list', () => {
  it('excludes archived and soft-deleted surveys for the current tenant', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const { svc } = serviceWithPrisma({ survey: { findMany } });

    await svc.list(user());

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-a',
          status: { not: 'archived' },
          deletedAt: null,
        }),
      }),
    );
  });
});

describe('SurveysService.archive', () => {
  it('sets status archived, deactivates distributions, and keeps the row', async () => {
    const survey = {
      id: 's1',
      name: 'NPS',
      tenantId: 'tenant-a',
      status: 'published',
    };
    const updateMany = jest.fn();
    const update = jest.fn();
    const distFindMany = jest.fn().mockResolvedValue([{ id: 'd1' }]);
    const findFirstOrThrow = jest.fn().mockResolvedValue(survey);
    const $transaction = jest.fn((fn: (tx: unknown) => unknown) =>
      Promise.resolve(
        fn({
          surveyDistribution: { updateMany, findMany: distFindMany },
          survey: { update },
        }),
      ),
    );
    const { svc, audit } = serviceWithPrisma({
      survey: { findFirstOrThrow },
      $transaction,
    });

    await expect(svc.archive(user(), 's1')).resolves.toEqual({ ok: true });

    expect(findFirstOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 's1',
          tenantId: 'tenant-a',
          deletedAt: null,
        }),
      }),
    );
    expect(updateMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a', surveyId: 's1' },
      data: { active: false },
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { status: 'archived', archivedAt: expect.any(Date) },
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'survey.archived',
        entityId: 's1',
        summary: expect.objectContaining({ deactivatedDistributionIds: ['d1'] }),
      }),
    );
  });
});

describe('SurveysService.remove', () => {
  it('soft-deletes with deletedAt and does not hard-delete the survey', async () => {
    const survey = {
      id: 's1',
      name: 'NPS',
      tenantId: 'tenant-a',
      status: 'published',
    };
    const updateMany = jest.fn();
    const update = jest.fn();
    const del = jest.fn();
    const findFirstOrThrow = jest.fn().mockResolvedValue(survey);
    const $transaction = jest.fn((fn: (tx: unknown) => unknown) =>
      Promise.resolve(
        fn({
          surveyDistribution: { updateMany },
          survey: { update, delete: del },
        }),
      ),
    );
    const { svc, audit } = serviceWithPrisma({
      survey: { findFirstOrThrow, delete: del },
      $transaction,
    });

    await expect(svc.remove(user(), 's1')).resolves.toEqual({ ok: true });

    expect(updateMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a', surveyId: 's1' },
      data: { active: false },
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { deletedAt: expect.any(Date) },
    });
    expect(del).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'survey.deleted', entityId: 's1' }),
    );
  });
});

describe('SurveysService.list includeArchived', () => {
  it('includes archived surveys and maps responsesCount', async () => {
    const findMany = jest.fn().mockResolvedValue([
      { id: 's1', status: 'archived', _count: { responses: 7 } },
    ]);
    const { svc } = serviceWithPrisma({ survey: { findMany } });

    const rows = await svc.list(user(), { includeArchived: true });

    const where = (findMany.mock.calls[0] as Array<{ where: Record<string, unknown> }>)[0].where;
    expect(where.status).toBeUndefined();
    expect(where.deletedAt).toBeNull();
    expect(rows).toEqual([{ id: 's1', status: 'archived', responsesCount: 7 }]);
  });
});

describe('SurveysService.unarchive', () => {
  function setup(survey: Record<string, unknown>, summary: unknown) {
    const update = jest.fn();
    const updateMany = jest.fn();
    const create = jest.fn().mockResolvedValue({ id: 'new', publicToken: 'tok' });
    const prisma = {
      survey: { findFirstOrThrow: jest.fn().mockResolvedValue(survey) },
      auditLog: { findFirst: jest.fn().mockResolvedValue(summary ? { summary } : null) },
      surveyUnit: { findMany: jest.fn().mockResolvedValue([{ unitId: 'u1' }]) },
      surveyDistribution: {
        findMany: jest.fn().mockResolvedValue([{ id: 'd1', unitId: 'u1', publicToken: 't1' }]),
        create,
      },
      $transaction: jest.fn((fn: (tx: unknown) => unknown) =>
        Promise.resolve(fn({ survey: { update }, surveyDistribution: { updateMany } })),
      ),
    };
    const { svc } = serviceWithPrisma(prisma);
    return { svc, update, updateMany, create };
  }

  it('returns a published survey to published and reactivates recorded distributions', async () => {
    const { svc, update, updateMany, create } = setup(
      { id: 's1', name: 'NPS', status: 'archived', publishedVersionId: 'v1' },
      { deactivatedDistributionIds: ['d1'] },
    );
    await expect(svc.unarchive(user(), 's1')).resolves.toEqual({ ok: true, status: 'published' });
    expect(update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { status: 'published', archivedAt: null },
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a', surveyId: 's1', id: { in: ['d1'] } },
      data: { active: true },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('returns a never-published survey to draft', async () => {
    const { svc, update } = setup(
      { id: 's1', name: 'NPS', status: 'archived', publishedVersionId: null, publishedAt: null },
      { deactivatedDistributionIds: [] },
    );
    await expect(svc.unarchive(user(), 's1')).resolves.toEqual({ ok: true, status: 'draft' });
    expect(update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { status: 'draft', archivedAt: null },
    });
  });

  it('rejects surveys that are not archived', async () => {
    const { svc } = setup({ id: 's1', status: 'published' }, null);
    await expect(svc.unarchive(user(), 's1')).rejects.toThrow('survey_not_archived');
  });
});

describe('SurveysService.publish distributions', () => {
  it('creates only the missing per-unit distributions', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'd2', publicToken: 'tok2' });
    const prisma = {
      survey: {
        findFirstOrThrow: jest.fn().mockResolvedValue({ id: 's1', tenantId: 'tenant-a' }),
        update: jest.fn(),
      },
      surveyVersion: {
        findFirst: jest.fn().mockResolvedValue({ id: 'v1', questions: [] }),
        update: jest.fn().mockResolvedValue({ id: 'v1', version: 1 }),
      },
      surveyUnit: {
        findMany: jest.fn().mockResolvedValue([{ unitId: 'u1' }, { unitId: 'u2' }]),
      },
      surveyDistribution: {
        findMany: jest.fn().mockResolvedValue([{ id: 'd1', unitId: 'u1', publicToken: 'tok1' }]),
        create,
      },
    };
    const { svc } = serviceWithPrisma(prisma);

    const result = await svc.publish(user(), 's1');

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ unitId: 'u2', active: true, surveyId: 's1' }),
      }),
    );
    expect(result.publicToken).toBe('tok1');
  });
});
