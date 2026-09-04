import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth.types';
import { PermissionCodes } from '../rbac/permission-codes';
import { randomToken } from '../common/crypto';
import type { CreateSurveyDto } from './dto/create-survey.dto';
import type { UpdateSurveyDto } from './dto/update-survey.dto';
import type { CreateDistributionDto } from './dto/create-distribution.dto';
import { AuditService } from '../audit/audit.service';
import type { Request } from 'express';

@Injectable()
export class SurveysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async getAccessibleSurvey(user: AuthUser, surveyId: string) {
    const canSeeAllUnits = user.permissionCodes.includes(PermissionCodes.UnitManage);
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
      where: { id: surveyId, tenantId: user.tenantId, ...unitFilter },
    });
  }

  private validateQuestions(questions: Array<{ type: string }>) {
    const npsIndex = questions.findIndex((q) => q.type === 'nps');
    if (npsIndex !== 0) throw new BadRequestException('nps_required_first');
    if (questions.filter((q) => q.type === 'nps').length !== 1) throw new BadRequestException('nps_required_single');
  }

  private validateUnitIds(user: AuthUser, unitIds: string[]) {
    const canSeeAllUnits = user.permissionCodes.includes(PermissionCodes.UnitManage);
    if (!canSeeAllUnits) {
      for (const unitId of unitIds) {
        if (!user.unitIds.includes(unitId)) throw new ForbiddenException();
      }
    }
  }

  async list(user: AuthUser) {
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

    return this.prisma.survey.findMany({
      where: { tenantId: user.tenantId, ...unitFilter },
      include: { units: { include: { unit: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(user: AuthUser, surveyId: string) {
    const survey = await this.getAccessibleSurvey(user, surveyId);

    const draft = await this.prisma.surveyVersion.findFirst({
      where: { surveyId: survey.id, tenantId: user.tenantId, status: 'draft' },
      orderBy: { version: 'desc' },
      include: { questions: { orderBy: { order: 'asc' } } },
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
              config: q.config as unknown,
              helpText: q.helpText,
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
          createMany: {
            data: dto.questions.map((q, idx) => ({
              tenantId: user.tenantId,
              title: q.title,
              type: q.type,
              required: q.required ?? false,
              order: idx + 1,
              config: q.config as any,
            })),
          },
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

  async update(user: AuthUser, surveyId: string, dto: UpdateSurveyDto, req?: Request) {
    const survey = await this.getAccessibleSurvey(user, surveyId);
    if (survey.status !== 'draft') throw new BadRequestException('only_draft_editable');

    if (dto.questions) this.validateQuestions(dto.questions);
    if (dto.unitIds) this.validateUnitIds(user, dto.unitIds);

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.survey.update({
        where: { id: survey.id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.collectCustomer !== undefined ? { collectCustomer: dto.collectCustomer } : {}),
          ...(dto.anonymousAllowed !== undefined ? { anonymousAllowed: dto.anonymousAllowed } : {}),
          ...(dto.collectEmployee !== undefined ? { collectEmployee: dto.collectEmployee } : {}),
        },
      });

      if (dto.unitIds) {
        await tx.surveyUnit.deleteMany({ where: { surveyId: survey.id } });
        if (dto.unitIds.length > 0) {
          await tx.surveyUnit.createMany({
            data: dto.unitIds.map((unitId) => ({ surveyId: survey.id, unitId })),
          });
        }
      }

      let versionId: string | null = null;
      if (dto.questions) {
        const draft = await tx.surveyVersion.findFirst({
          where: { tenantId: user.tenantId, surveyId: survey.id, status: 'draft' },
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
          })),
        } as any;

        await tx.surveyVersion.update({
          where: { id: draft.id },
          data: {
            snapshot,
            questions: {
              createMany: {
                data: dto.questions.map((q, idx) => ({
                  tenantId: user.tenantId,
                  title: q.title,
                  type: q.type,
                  required: q.required ?? false,
                  order: idx + 1,
                  config: q.config as any,
                })),
              },
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
      },
    });

    const defaultUnit = await this.prisma.surveyUnit.findFirst({
      where: { surveyId: survey.id },
      select: { unitId: true },
      orderBy: { unitId: 'asc' },
    });

    const distribution = await this.prisma.surveyDistribution.create({
      data: {
        tenantId: user.tenantId,
        surveyId: survey.id,
        unitId: defaultUnit?.unitId,
        channel: 'qrcode',
        publicToken: randomToken(16),
        active: true,
      },
    });

    await this.audit.log({
      tenantId: user.tenantId,
      actorType: 'user',
      actorUserId: user.userId,
      action: 'survey.published',
      entity: 'Survey',
      entityId: survey.id,
      summary: { version: published.version, distributionId: distribution.id },
      req,
    });

    return { surveyId: survey.id, versionId: published.id, publicToken: distribution.publicToken };
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

  async archive(user: AuthUser, surveyId: string, req?: Request) {
    const survey = await this.getAccessibleSurvey(user, surveyId);

    await this.prisma.$transaction(async (tx) => {
      await tx.surveyDistribution.updateMany({
        where: { tenantId: user.tenantId, surveyId: survey.id },
        data: { active: false },
      });
      await tx.survey.update({
        where: { id: survey.id },
        data: { status: 'archived' },
      });
    });

    await this.audit.log({
      tenantId: user.tenantId,
      actorType: 'user',
      actorUserId: user.userId,
      action: 'survey.archived',
      entity: 'Survey',
      entityId: survey.id,
      summary: { name: survey.name } as any,
      req,
    });

    return { ok: true };
  }
}
