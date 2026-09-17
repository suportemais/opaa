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
    const findFirstOrThrow = jest.fn().mockResolvedValue(survey);
    const $transaction = jest.fn((fn: (tx: unknown) => unknown) =>
      Promise.resolve(
        fn({
          surveyDistribution: { updateMany },
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
      data: { status: 'archived' },
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'survey.archived', entityId: 's1' }),
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
