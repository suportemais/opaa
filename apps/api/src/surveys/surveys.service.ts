import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth.types';
import { PermissionCodes } from '../rbac/permission-codes';
import { randomToken } from '../common/crypto';
import type { CreateSurveyDto } from './dto/create-survey.dto';
import type { UpdateSurveyDto } from './dto/update-survey.dto';
import type { CreateDistributionDto } from './dto/create-distribution.dto';
import { AuditService } from '../audit/audit.service';
import type { Request } from 'express';
import {
  isSingleChoiceQuestionType,
  normalizeQuestionOptions,
  validateSurveyQuestionTypes,
} from '../domain/surveys/question-types';
import {
  assertSurveyUpdateAllowed,
  isIdentitySettingsOnlyUpdate,
} from '../domain/surveys/survey-update';
import { defaultSurveyListWhere } from '../domain/surveys/survey-visibility';

@Injectable()
export class SurveysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async getAccessibleSurvey(user: AuthUser, surveyId: string) {
    const canSeeAllUnits = user.permissionCodes.includes(
      PermissionCodes.UnitManage,
    );
    const unitFilter = canSeeAllUnits
      ? {}
      : {
          units: {
            some: {
              unitId: { in: user.unitIds.length ? user.unitIds : ['__none__'] },
            },
          },
        };

    return this.prisma.survey.findFirstOrThrow({
      where: {
        id: surveyId,
        tenantId: user.tenantId,
        deletedAt: null,
        ...unitFilter,
      },
    });
  }

  private validateQuestions(
    questions: Parameters<typeof validateSurveyQuestionTypes>[0],
  ) {
    const result = validateSurveyQuestionTypes(questions);
    if (!result.ok) throw new BadRequestException(result.code);
  }

  private questionCreateData(
    tenantId: string,
    q: {
      title: string;
      type: string;
      required?: boolean;
      config?: unknown;
      options?: Array<{
        label: string;
        value?: string;
        negative?: boolean;
      }>;
    },
    idx: number,
  ) {
    const options = isSingleChoiceQuestionType(q.type)
      ? normalizeQuestionOptions(q.options)
      : [];
    return {
      tenantId,
      title: q.title,
      type: q.type,
      required: q.required ?? false,
      order: idx + 1,
      config: q.config as any,
      ...(options.length
        ? {
            options: {
              create: options.map((o) => ({
                label: o.label,
                value: o.value,
                negative: o.negative,
                order: o.order,
              })),
            },
          }
        : {}),
    };
  }

  private validateUnitIds(user: AuthUser, unitIds: string[]) {
    const canSeeAllUnits = user.permissionCodes.includes(
      PermissionCodes.UnitManage,
    );
    if (!canSeeAllUnits) {
      for (const unitId of unitIds) {
        if (!user.unitIds.includes(unitId)) throw new ForbiddenException();
      }
    }
  }

  async list(user: AuthUser, opts: { includeArchived?: boolean } = {}) {
    const canSeeAll = user.permissionCodes.includes(PermissionCodes.UnitManage);

    const unitFilter = canSeeAll
      ? {}
      : {
          units: {
            some: {
              unitId: { in: user.unitIds.length ? user.unitIds : ['__none__'] },
            },
          },
        };

    const rows = await this.prisma.survey.findMany({
      where: {
        tenantId: user.tenantId,
        ...(opts.includeArchived ? { deletedAt: null } : defaultSurveyListWhere()),
        ...unitFilter,
      },
      include: {
        units: { include: { unit: true } },
        _count: { select: { responses: { where: { status: 'completed' } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return (rows ?? []).map(({ _count, ...rest }) => {
      return { ...rest, responsesCount: _count?.responses ?? 0 };
    });
  }

  async getById(user: AuthUser, surveyId: string) {
    const survey = await this.getAccessibleSurvey(user, surveyId);

    const draft = await this.prisma.surveyVersion.findFirst({
      where: { surveyId: survey.id, tenantId: user.tenantId, status: 'draft' },
      orderBy: { version: 'desc' },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: { options: { orderBy: { order: 'asc' } } },
        },
      },
    });

    const units = await this.prisma.surveyUnit.findMany({
      where: { surveyId: survey.id },
      include: { unit: true },
      orderBy: { unitId: 'asc' },
    });

    return {
      id: survey.id,
      name: survey.name,
      description: survey.description,
      status: survey.status,
      collectCustomer: survey.collectCustomer,
      anonymousAllowed: survey.anonymousAllowed,
      collectEmployee: survey.collectEmployee,
      createdAt: survey.createdAt,
      publishedAt: survey.publishedAt ?? null,
      archivedAt: survey.archivedAt ?? null,
      units,
      draftVersion: draft
        ? {
            id: draft.id,
            version: draft.version,
            status: draft.status,
            questions: draft.questions.map((q) => ({
              id: q.id,
              title: q.title,
              type: q.type,
              required: q.required,
              order: q.order,
              category: q.category,
              config: q.config,
              helpText: q.helpText,
              options: q.options.map((o) => ({
                id: o.id,
                label: o.label,
                value: o.value,
                order: o.order,
                negative: o.negative,
              })),
            })),
          }
        : null,
    };
  }

  async create(user: AuthUser, dto: CreateSurveyDto, req?: Request) {
    this.validateQuestions(dto.questions);
    this.validateUnitIds(user, dto.unitIds);

    const survey = await this.prisma.survey.create({
      data: {
        tenantId: user.tenantId,
        name: dto.name,
        description: dto.description,
        status: 'draft',
        collectCustomer: dto.collectCustomer ?? false,
        anonymousAllowed: dto.anonymousAllowed ?? true,
        collectEmployee: dto.collectEmployee ?? false,
        units: {
          createMany: { data: dto.unitIds.map((unitId) => ({ unitId })) },
        },
      },
    });

    const snapshot = {
      name: survey.name,
      description: survey.description,
      questions: dto.questions.map((q, idx) => ({
        order: idx + 1,
        title: q.title,
        type: q.type,
        required: q.required ?? false,
        config: q.config,
        options: isSingleChoiceQuestionType(q.type)
          ? normalizeQuestionOptions(q.options)
          : [],
      })),
    } as any;

    const version = await this.prisma.surveyVersion.create({
      data: {
        tenantId: user.tenantId,
        surveyId: survey.id,
        version: 1,
        status: 'draft',
        snapshot,
        questions: {
          create: dto.questions.map((q, idx) =>
            this.questionCreateData(user.tenantId, q, idx),
          ),
        },
      },
    });

    await this.audit.log({
      tenantId: user.tenantId,
      actorType: 'user',
      actorUserId: user.userId,
      action: 'survey.created',
      entity: 'Survey',
      entityId: survey.id,
      summary: { name: survey.name, version: version.version },
      req,
    });

    return { ...survey, draftVersionId: version.id };
  }

  async update(
    user: AuthUser,
    surveyId: string,
    dto: UpdateSurveyDto,
    req?: Request,
  ) {
    const survey = await this.getAccessibleSurvey(user, surveyId);
    const allowed = assertSurveyUpdateAllowed(survey.status, dto);
    if (!allowed.ok) throw new BadRequestException(allowed.code);

    if (dto.questions) this.validateQuestions(dto.questions);
    if (dto.unitIds) this.validateUnitIds(user, dto.unitIds);

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.survey.update({
        where: { id: survey.id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description }
            : {}),
          ...(dto.collectCustomer !== undefined
            ? { collectCustomer: dto.collectCustomer }
            : {}),
          ...(dto.anonymousAllowed !== undefined
            ? { anonymousAllowed: dto.anonymousAllowed }
            : {}),
          ...(dto.collectEmployee !== undefined
            ? { collectEmployee: dto.collectEmployee }
            : {}),
        },
      });

      if (dto.unitIds) {
        await tx.surveyUnit.deleteMany({ where: { surveyId: survey.id } });
        if (dto.unitIds.length > 0) {
          await tx.surveyUnit.createMany({
            data: dto.unitIds.map((unitId) => ({
              surveyId: survey.id,
              unitId,
            })),
          });
        }
      }

      let versionId: string | null = null;
      if (dto.questions) {
        const draft = await tx.surveyVersion.findFirst({
          where: {
            tenantId: user.tenantId,
            surveyId: survey.id,
            status: 'draft',
          },
          orderBy: { version: 'desc' },
          select: { id: true },
        });
        if (!draft) throw new NotFoundException('no_draft_version');
        versionId = draft.id;

        await tx.question.deleteMany({
          where: { tenantId: user.tenantId, surveyVersionId: draft.id },
        });

        const snapshot = {
          name: updated.name,
          description: updated.description,
          questions: dto.questions.map((q, idx) => ({
            order: idx + 1,
            title: q.title,
            type: q.type,
            required: q.required ?? false,
            config: q.config,
            options: isSingleChoiceQuestionType(q.type)
              ? normalizeQuestionOptions(q.options)
              : [],
          })),
        } as any;

        await tx.surveyVersion.update({
          where: { id: draft.id },
          data: {
            snapshot,
            questions: {
              create: dto.questions.map((q, idx) =>
                this.questionCreateData(user.tenantId, q, idx),
              ),
            },
          },
        });
      }

      return { updated, versionId };
    });

    await this.audit.log({
      tenantId: user.tenantId,
      actorType: 'user',
      actorUserId: user.userId,
      action: 'survey.updated',
      entity: 'Survey',
      entityId: survey.id,
      summary: {
        name: result.updated.name,
        ...(dto.questions ? { questionsUpdated: true } : {}),
        ...(dto.unitIds ? { unitsUpdated: true } : {}),
        ...(isIdentitySettingsOnlyUpdate(dto) ? { identityUpdated: true } : {}),
      },
      req,
    });

    return { ok: true, id: survey.id };
  }

  async listDistributions(user: AuthUser, surveyId: string) {
    const survey = await this.getAccessibleSurvey(user, surveyId);
    return this.prisma.surveyDistribution.findMany({
      where: { tenantId: user.tenantId, surveyId: survey.id },
      include: { unit: true, employee: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async publish(user: AuthUser, surveyId: string, req?: Request) {
    const survey = await this.getAccessibleSurvey(user, surveyId);

    const draft = await this.prisma.surveyVersion.findFirst({
      where: { surveyId: survey.id, tenantId: user.tenantId, status: 'draft' },
      orderBy: { version: 'desc' },
      include: { questions: true },
    });
    if (!draft) throw new BadRequestException('no_draft_version');

    const published = await this.prisma.surveyVersion.update({
      where: { id: draft.id },
      data: { status: 'published' },
    });

    await this.prisma.survey.update({
      where: { id: survey.id },
      data: {
        status: 'published',
        publishedVersionId: published.id,
        publishedAt: new Date(),
        archivedAt: null,
      },
    });

    const distribution = await this.ensureUnitDistributions(
      user.tenantId,
      survey.id,
    );

    await this.audit.log({
      tenantId: user.tenantId,
      actorType: 'user',
      actorUserId: user.userId,
      action: 'survey.published',
      entity: 'Survey',
      entityId: survey.id,
      summary: {
        version: published.version,
        distributionId: distribution.id,
        createdDistributionIds: distribution.createdIds,
      },
      req,
    });

    return {
      surveyId: survey.id,
      versionId: published.id,
      publicToken: distribution.publicToken,
    };
  }

  async createDistribution(user: AuthUser, dto: CreateDistributionDto) {
    const survey = await this.getAccessibleSurvey(user, dto.surveyId);

    const distribution = await this.prisma.surveyDistribution.create({
      data: {
        tenantId: user.tenantId,
        surveyId: survey.id,
        unitId: dto.unitId,
        employeeId: dto.employeeId,
        channel: dto.channel,
        campaign: dto.campaign,
        publicToken: randomToken(16),
        active: true,
      },
    });

    return distribution;
  }

  /**
   * Garante uma distribuição ativa (sem atendente) por unidade da pesquisa.
   * Só cria as que faltam; nunca remove nem desativa distribuições existentes.
   * Retorna a distribuição da unidade padrão (menor unitId) para compatibilidade.
   */
  private async ensureUnitDistributions(tenantId: string, surveyId: string) {
    const units = await this.prisma.surveyUnit.findMany({
      where: { surveyId },
      select: { unitId: true },
      orderBy: { unitId: 'asc' },
    });
    const existing = await this.prisma.surveyDistribution.findMany({
      where: { tenantId, surveyId, active: true, employeeId: null },
      select: { id: true, unitId: true, publicToken: true },
      orderBy: { createdAt: 'asc' },
    });

    const targetUnitIds: Array<string | null> = units.length
      ? units.map((u) => u.unitId)
      : [null];

    const createdIds: string[] = [];
    const byUnit = new Map<string | null, { id: string; publicToken: string }>();
    for (const d of existing) {
      if (!byUnit.has(d.unitId)) byUnit.set(d.unitId, d);
    }

    for (const unitId of targetUnitIds) {
      if (byUnit.has(unitId)) continue;
      const created = await this.prisma.surveyDistribution.create({
        data: {
          tenantId,
          surveyId,
          unitId: unitId ?? undefined,
          channel: 'qrcode',
          publicToken: randomToken(16),
          active: true,
        },
        select: { id: true, publicToken: true },
      });
      createdIds.push(created.id);
      byUnit.set(unitId, created);
    }

    const primary = byUnit.get(targetUnitIds[0])!;
    return { id: primary.id, publicToken: primary.publicToken, createdIds };
  }

  async archive(user: AuthUser, surveyId: string, req?: Request) {
    const survey = await this.getAccessibleSurvey(user, surveyId);

    const deactivatedDistributionIds = await this.prisma.$transaction(
      async (tx) => {
        const active = await tx.surveyDistribution.findMany({
          where: { tenantId: user.tenantId, surveyId: survey.id, active: true },
          select: { id: true },
        });
        await tx.surveyDistribution.updateMany({
          where: { tenantId: user.tenantId, surveyId: survey.id },
          data: { active: false },
        });
        await tx.survey.update({
          where: { id: survey.id },
          data: { status: 'archived', archivedAt: new Date() },
        });
        return (active ?? []).map((d) => d.id);
      },
    );

    await this.audit.log({
      tenantId: user.tenantId,
      actorType: 'user',
      actorUserId: user.userId,
      action: 'survey.archived',
      entity: 'Survey',
      entityId: survey.id,
      summary: {
        name: survey.name,
        previousStatus: survey.status,
        deactivatedDistributionIds,
      },
      req,
    });

    return { ok: true };
  }

  /**
   * Desarquiva: volta para `published` se a pesquisa já foi publicada
   * (publishedVersionId/publishedAt), senão `draft`. Reativa as distribuições
   * que o arquivamento desativou (registradas no audit log; em arquivamentos
   * antigos, sem esse registro, reativa todas — o arquivamento era o único
   * caminho que desativava distribuições de uma pesquisa não excluída).
   */
  async unarchive(user: AuthUser, surveyId: string, req?: Request) {
    const survey = await this.getAccessibleSurvey(user, surveyId);
    if (survey.status !== 'archived') {
      throw new BadRequestException('survey_not_archived');
    }

    const wasPublished = !!(survey.publishedVersionId || survey.publishedAt);
    const nextStatus = wasPublished ? 'published' : 'draft';

    const lastArchive = await this.prisma.auditLog.findFirst({
      where: {
        tenantId: user.tenantId,
        action: 'survey.archived',
        entity: 'Survey',
        entityId: survey.id,
      },
      orderBy: { occurredAt: 'desc' },
      select: { summary: true },
    });
    const summary = (lastArchive?.summary ?? null) as {
      deactivatedDistributionIds?: unknown;
    } | null;
    const recordedIds = Array.isArray(summary?.deactivatedDistributionIds)
      ? (summary.deactivatedDistributionIds as unknown[]).filter(
          (id): id is string => typeof id === 'string',
        )
      : null;

    await this.prisma.$transaction(async (tx) => {
      await tx.survey.update({
        where: { id: survey.id },
        data: { status: nextStatus, archivedAt: null },
      });
      if (recordedIds === null) {
        await tx.surveyDistribution.updateMany({
          where: { tenantId: user.tenantId, surveyId: survey.id },
          data: { active: true },
        });
      } else if (recordedIds.length) {
        await tx.surveyDistribution.updateMany({
          where: {
            tenantId: user.tenantId,
            surveyId: survey.id,
            id: { in: recordedIds },
          },
          data: { active: true },
        });
      }
    });

    if (nextStatus === 'published') {
      await this.ensureUnitDistributions(user.tenantId, survey.id);
    }

    await this.audit.log({
      tenantId: user.tenantId,
      actorType: 'user',
      actorUserId: user.userId,
      action: 'survey.unarchived',
      entity: 'Survey',
      entityId: survey.id,
      summary: { name: survey.name, status: nextStatus },
      req,
    });

    return { ok: true, status: nextStatus };
  }

  async remove(user: AuthUser, surveyId: string, req?: Request) {
    const survey = await this.getAccessibleSurvey(user, surveyId);

    await this.prisma.$transaction(async (tx) => {
      await tx.surveyDistribution.updateMany({
        where: { tenantId: user.tenantId, surveyId: survey.id },
        data: { active: false },
      });
      await tx.survey.update({
        where: { id: survey.id },
        data: { deletedAt: new Date() },
      });
    });

    await this.audit.log({
      tenantId: user.tenantId,
      actorType: 'user',
      actorUserId: user.userId,
      action: 'survey.deleted',
      entity: 'Survey',
      entityId: survey.id,
      summary: { name: survey.name, status: survey.status },
      req,
    });

    return { ok: true };
  }
}
