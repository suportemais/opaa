import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth.types';
import { PermissionCodes } from '../rbac/permission-codes';
import { randomToken } from '../common/crypto';
import type { CreateSurveyDto } from './dto/create-survey.dto';
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

  async create(user: AuthUser, dto: CreateSurveyDto, req?: Request) {
    const npsIndex = dto.questions.findIndex((q) => q.type === 'nps');
    if (npsIndex !== 0) {
      throw new BadRequestException('nps_required_first');
    }
    if (dto.questions.filter((q) => q.type === 'nps').length !== 1) {
      throw new BadRequestException('nps_required_single');
    }

    const canSeeAllUnits = user.permissionCodes.includes(PermissionCodes.UnitManage);
    if (!canSeeAllUnits) {
      for (const unitId of dto.unitIds) {
        if (!user.unitIds.includes(unitId)) {
          throw new ForbiddenException();
        }
      }
    }

    const survey = await this.prisma.survey.create({
      data: {
        tenantId: user.tenantId,
        name: dto.name,
        description: dto.description,
        status: 'draft',
        collectCustomer: dto.collectCustomer ?? false,
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
