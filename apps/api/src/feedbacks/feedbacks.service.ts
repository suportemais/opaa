import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth.types';
import { PermissionCodes } from '../rbac/permission-codes';
import type { UpdateCaseDto } from './dto/update-case.dto';
import type { CreateCaseInteractionDto } from './dto/create-case-interaction.dto';
import { WebhookOutboxService } from '../webhook-outbox/webhook-outbox.service';
import {
  CANONICAL_THEMES,
  SENTIMENT_LABELS,
  type CanonicalTheme,
  type SentimentLabel,
} from '../domain/sentiment/classify';

@Injectable()
export class FeedbacksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly webhookOutbox: WebhookOutboxService,
  ) {}

  private startOfUtcDay(d: Date) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
  }

  private endOfUtcDay(d: Date) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
  }

  private resolveRange(params: { from?: string; to?: string }) {
    if (!params.from && !params.to) return null;

    const toInput = params.to ? new Date(params.to) : new Date();
    if (Number.isNaN(toInput.getTime())) throw new BadRequestException('invalid_to');

    const fromInput = params.from ? new Date(params.from) : new Date(toInput.getTime() - 29 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(fromInput.getTime())) throw new BadRequestException('invalid_from');

    const from = this.startOfUtcDay(fromInput);
    const to = this.endOfUtcDay(toInput);
    if (from.getTime() > to.getTime()) throw new BadRequestException('invalid_range');
    return { from, to };
  }

  private unitWhere(user: AuthUser) {
    const canSeeAll = user.permissionCodes.includes(PermissionCodes.UnitManage);
    if (canSeeAll) return {};
    const allowed = user.unitIds.length ? user.unitIds : ['__none__'];
    return { OR: [{ unitId: { in: allowed } }, { unitId: null }] };
  }

  list(
    user: AuthUser,
    params: {
      take?: number;
      cursor?: string;
      caseFilter?: string;
      assignee?: string;
      due?: string;
      npsClass?: string;
      sentiment?: string;
      theme?: string;
      sentimentTheme?: string;
      from?: string;
      to?: string;
      unitId?: string;
    },
  ) {
    const take = Math.min(Math.max(params.take ?? 20, 1), 50);
    const canSeeAll = user.permissionCodes.includes(PermissionCodes.UnitManage);
    if (params.unitId && !canSeeAll) {
      if (!user.unitIds.includes(params.unitId)) throw new ForbiddenException();
    }
    const unitWhere = params.unitId ? { unitId: params.unitId } : this.unitWhere(user);

    const range = this.resolveRange(params);

    let npsClass: 'detractor' | 'passive' | 'promoter' | undefined;
    if (params.npsClass === 'detractor' || params.npsClass === 'passive' || params.npsClass === 'promoter') {
      npsClass = params.npsClass;
    } else if (params.npsClass === 'any' || !params.npsClass) {
      // no NPS class filter
    } else {
      throw new BadRequestException('invalid_nps_class');
    }

    let sentiment: SentimentLabel | undefined;
    if (
      (SENTIMENT_LABELS as readonly string[]).includes(params.sentiment ?? '')
    ) {
      sentiment = params.sentiment as SentimentLabel;
    } else if (params.sentiment === 'any' || !params.sentiment) {
      // no sentiment filter
    } else {
      throw new BadRequestException('invalid_sentiment');
    }

    const themeRaw = params.theme || params.sentimentTheme;
    let theme: CanonicalTheme | undefined;
    if ((CANONICAL_THEMES as readonly string[]).includes(themeRaw ?? '')) {
      theme = themeRaw as CanonicalTheme;
    } else if (themeRaw === 'any' || !themeRaw) {
      // no theme filter
    } else {
      throw new BadRequestException('invalid_theme');
    }

    const sentimentThemeWhere =
      theme === 'outro'
        ? {
            OR: [
              { sentimentTheme: 'outro' },
              {
                sentimentTheme: null,
                ...(sentiment ? {} : { sentiment: { not: null } }),
              },
            ],
          }
        : theme
          ? { sentimentTheme: theme }
          : undefined;

    const openStatuses = ['new', 'viewed', 'in_progress', 'waiting_customer'];

    const caseWhere: Record<string, unknown> = {};
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const next7Start = new Date(todayStart);
    next7Start.setDate(next7Start.getDate() + 7);

    if (params.caseFilter === 'open') {
      caseWhere.status = { in: openStatuses };
    } else if (params.caseFilter === 'closed') {
      caseWhere.status = { in: ['resolved', 'closed', 'dismissed'] };
    } else if (params.caseFilter === 'with') {
      // responses that have a case, no extra status filter
    } else if (params.caseFilter === 'none') {
      // handled via relation filter below
    } else if (params.caseFilter) {
      throw new BadRequestException('invalid_case_filter');
    }

    if (params.assignee === 'me') {
      caseWhere.assigneeUserId = user.userId;
    } else if (params.assignee === 'unassigned') {
      caseWhere.assigneeUserId = null;
    } else if (params.assignee === 'any' || !params.assignee) {
      // no assignee filter
    } else {
      throw new BadRequestException('invalid_assignee');
    }

    if (params.due === 'overdue') {
      caseWhere.dueAt = { lt: todayStart };
    } else if (params.due === 'today') {
      caseWhere.dueAt = { gte: todayStart, lt: tomorrowStart };
    } else if (params.due === 'next7') {
      caseWhere.dueAt = { gte: todayStart, lt: next7Start };
    } else if (params.due === 'any' || !params.due) {
      // no due-date filter
    } else {
      throw new BadRequestException('invalid_due');
    }

    const feedbackCaseFilter =
      params.caseFilter === 'none'
        ? { is: null }
        : params.caseFilter === 'with' && Object.keys(caseWhere).length === 0
          ? { isNot: null }
          : Object.keys(caseWhere).length
            ? { is: caseWhere }
            : undefined;

    const extraFilters: Record<string, unknown>[] = [];
    if (npsClass) extraFilters.push({ npsClass });
    if (sentiment) extraFilters.push({ sentiment });
    if (sentimentThemeWhere) extraFilters.push(sentimentThemeWhere);
    if (range)
      extraFilters.push({ completedAt: { gte: range.from, lte: range.to } });
    if (feedbackCaseFilter)
      extraFilters.push({ feedbackCase: feedbackCaseFilter });

    return this.prisma.surveyResponse.findMany({
      where: {
        tenantId: user.tenantId,
        status: 'completed',
        ...unitWhere,
        ...(extraFilters.length ? { AND: extraFilters } : {}),
      },
      orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
      take,
      ...(params.cursor ? { skip: 1, cursor: { id: params.cursor } } : {}),
      select: {
        id: true,
        surveyId: true,
        unitId: true,
        employeeId: true,
        channel: true,
        campaign: true,
        completedAt: true,
        npsScore: true,
        npsClass: true,
        mainComment: true,
        feedbackCase: {
          select: {
            id: true,
            status: true,
            priority: true,
            dueAt: true,
            assigneeUserId: true,
            assignee: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
  }

  detail(user: AuthUser, responseId: string) {
    const unitWhere = this.unitWhere(user);
    return this.prisma.surveyResponse.findFirstOrThrow({
      where: { id: responseId, tenantId: user.tenantId, ...unitWhere },
      include: {
        answers: { include: { question: true } },
        survey: true,
        surveyVersion: true,
        unit: true,
        employee: true,
        customer: true,
        feedbackCase: {
          include: {
            assignee: { select: { id: true, name: true, email: true } },
            customerInteractions: { orderBy: { createdAt: 'asc' } },
            events: { include: { createdBy: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: 'asc' } },
          },
        },
      },
    });
  }

  kanban(
    user: AuthUser,
    params: {
      caseFilter?: string;
      assignee?: string;
      due?: string;
    },
  ) {
    const unitWhere = this.unitWhere(user);
    const openStatuses = ['new', 'viewed', 'in_progress', 'waiting_customer'];

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const next7Start = new Date(todayStart);
    next7Start.setDate(next7Start.getDate() + 7);

    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
      ...unitWhere,
    };

    if (!params.caseFilter || params.caseFilter === 'open') {
      where.status = { in: openStatuses };
    } else if (params.caseFilter === 'closed') {
      where.status = { in: ['resolved', 'closed', 'dismissed'] };
    } else if (params.caseFilter === 'with') {
      // keep all statuses
    } else {
      throw new BadRequestException('invalid_case_filter');
    }

    if (params.assignee === 'me') {
      where.assigneeUserId = user.userId;
    } else if (params.assignee === 'unassigned') {
      where.assigneeUserId = null;
    } else if (params.assignee === 'any' || !params.assignee) {
      // no assignee filter
    } else {
      throw new BadRequestException('invalid_assignee');
    }

    if (params.due === 'overdue') {
      where.dueAt = { lt: todayStart };
    } else if (params.due === 'today') {
      where.dueAt = { gte: todayStart, lt: tomorrowStart };
    } else if (params.due === 'next7') {
      where.dueAt = { gte: todayStart, lt: next7Start };
    } else if (params.due === 'any' || !params.due) {
      // no due-date filter
    } else {
      throw new BadRequestException('invalid_due');
    }

    return this.prisma.feedbackCase.findMany({
      where: where as any,
      orderBy: [{ dueAt: 'asc' }, { updatedAt: 'desc' }, { id: 'desc' }],
      take: 500,
      select: {
        id: true,
        status: true,
        priority: true,
        dueAt: true,
        updatedAt: true,
        createdAt: true,
        assigneeUserId: true,
        assignee: { select: { id: true, name: true, email: true } },
        unit: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true, email: true, phone: true, doNotContact: true } },
        surveyResponse: { select: { id: true, completedAt: true, npsScore: true, npsClass: true, mainComment: true } },
      },
    });
  }

  async createCase(user: AuthUser, responseId: string) {
    const response = await this.prisma.surveyResponse.findFirst({
      where: { id: responseId, tenantId: user.tenantId, ...this.unitWhere(user) },
      include: {
        feedbackCase: true,
        survey: { select: { id: true, name: true } },
        distribution: { select: { id: true, publicToken: true, channel: true, campaign: true } },
        unit: { select: { id: true, name: true } },
        employee: { select: { id: true, name: true, code: true, roleTitle: true } },
        customer: { select: { id: true, name: true, email: true, phone: true, emailNormalized: true, phoneNormalized: true } },
        answers: { select: { questionId: true, value: true } },
      },
    });
    if (!response) throw new NotFoundException();
    if (response.feedbackCase) return response.feedbackCase;

    const created = await this.prisma.$transaction(async (tx) => {
      const caseRow = await tx.feedbackCase.create({
        data: {
          tenantId: user.tenantId,
          surveyResponseId: response.id,
          unitId: response.unitId,
          customerId: response.customerId,
          priority: 'normal',
          status: 'new',
          description: response.mainComment,
          events: {
            create: [
              {
                tenantId: user.tenantId,
                type: 'case.created_manual',
                data: { trigger: 'manual' } as any,
                createdByUserId: user.userId,
              },
            ],
          },
        },
        include: { events: true },
      });

      const payload = {
        feedbackCaseId: caseRow.id,
        trigger: 'manual',
        tenant: { id: user.tenantId },
        survey: response.survey ? { id: response.survey.id, name: response.survey.name } : null,
        surveyResponseId: response.id,
        distribution: response.distribution
          ? {
              id: response.distribution.id,
              publicToken: response.distribution.publicToken,
              channel: response.distribution.channel,
              campaign: response.distribution.campaign,
            }
          : null,
        nps: {
          score: response.npsScore,
          class: response.npsClass,
          badScoreThreshold: null,
        },
        unit: response.unit ? { id: response.unit.id, name: response.unit.name } : null,
        employee: response.employee
          ? { id: response.employee.id, name: response.employee.name, code: response.employee.code, roleTitle: response.employee.roleTitle }
          : null,
        customer: response.customer
          ? {
              id: response.customer.id,
              name: response.customer.name ?? null,
              email: response.customer.email ?? null,
              emailNormalized: response.customer.emailNormalized ?? null,
              phone: response.customer.phone ?? null,
              phoneNormalized: response.customer.phoneNormalized ?? null,
            }
          : null,
        mainComment: response.mainComment ?? null,
        completedAt: response.completedAt ? (response.completedAt as Date).toISOString() : null,
        idempotencyKey: (response as any).idempotencyKey ?? null,
        answers: response.answers.map((a) => ({ questionId: a.questionId, value: a.value })),
        createdByUser: {
          id: user.userId,
          name: user.name,
          email: user.email,
        },
      };

      await tx.webhookOutbox.create({
        data: {
          tenantId: user.tenantId,
          eventType: 'feedback_case.created',
          payload: payload as any,
          status: 'pending',
          attempts: 0,
          maxAttempts: 10,
          nextAttemptAt: new Date(),
        },
      });

      return caseRow;
    });

    return created;
  }

  async updateCase(user: AuthUser, responseId: string, dto: UpdateCaseDto) {
    const response = await this.prisma.surveyResponse.findFirst({
      where: { id: responseId, tenantId: user.tenantId, ...this.unitWhere(user) },
      include: { feedbackCase: true },
    });
    if (!response) throw new NotFoundException();

    const current = response.feedbackCase ?? (await this.createCase(user, responseId));

    const events: Array<{ tenantId: string; feedbackCaseId: string; type: string; data?: any; createdByUserId?: string }> = [];

    if (dto.status && dto.status !== current.status) {
      events.push({
        tenantId: user.tenantId,
        feedbackCaseId: current.id,
        type: 'case.status_changed',
        data: { from: current.status, to: dto.status } as any,
        createdByUserId: user.userId,
      });
    }

    if (dto.priority && dto.priority !== current.priority) {
      events.push({
        tenantId: user.tenantId,
        feedbackCaseId: current.id,
        type: 'case.priority_changed',
        data: { from: current.priority, to: dto.priority } as any,
        createdByUserId: user.userId,
      });
    }

    if (dto.assigneeUserId !== undefined && dto.assigneeUserId !== current.assigneeUserId) {
      events.push({
        tenantId: user.tenantId,
        feedbackCaseId: current.id,
        type: 'case.assignee_changed',
        data: { from: current.assigneeUserId, to: dto.assigneeUserId } as any,
        createdByUserId: user.userId,
      });
    }

    if (dto.dueAt !== undefined) {
      const dueAt = dto.dueAt ? new Date(dto.dueAt) : null;
      const currentDue = current.dueAt ? current.dueAt.toISOString() : null;
      const nextDue = dueAt ? dueAt.toISOString() : null;
      if (currentDue !== nextDue) {
        events.push({
          tenantId: user.tenantId,
          feedbackCaseId: current.id,
          type: 'case.due_changed',
          data: { from: currentDue, to: nextDue } as any,
          createdByUserId: user.userId,
        });
      }
    }

    const nextStatus = dto.status ?? current.status;
    const firstViewedAt = nextStatus !== 'new' && !current.firstViewedAt ? new Date() : undefined;
    const firstActionAt = nextStatus === 'in_progress' && !current.firstActionAt ? new Date() : undefined;
    const resolvedAt =
      (nextStatus === 'resolved' || nextStatus === 'closed') && !current.resolvedAt ? new Date() : nextStatus === 'new' ? null : undefined;

    const updated = await this.prisma.feedbackCase.update({
      where: { id: current.id },
      data: {
        status: dto.status as any,
        priority: dto.priority,
        assigneeUserId: dto.assigneeUserId,
        dueAt: dto.dueAt === undefined ? undefined : dto.dueAt ? new Date(dto.dueAt) : null,
        rootCause: dto.rootCause === undefined ? undefined : dto.rootCause.trim() || null,
        correctiveAction: dto.correctiveAction === undefined ? undefined : dto.correctiveAction.trim() || null,
        resolution: dto.resolution === undefined ? undefined : dto.resolution.trim() || null,
        firstViewedAt,
        firstActionAt,
        resolvedAt,
      },
    });

    if (events.length) {
      await this.prisma.feedbackCaseEvent.createMany({ data: events });
    }

    return updated;
  }

  async assignMe(user: AuthUser, responseId: string) {
    const response = await this.prisma.surveyResponse.findFirst({
      where: { id: responseId, tenantId: user.tenantId, ...this.unitWhere(user) },
      include: { feedbackCase: true },
    });
    if (!response) throw new NotFoundException();
    const current = response.feedbackCase ?? (await this.createCase(user, responseId));

    const updated = await this.prisma.feedbackCase.update({
      where: { id: current.id },
      data: { assigneeUserId: user.userId },
    });

    await this.prisma.feedbackCaseEvent.create({
      data: {
        tenantId: user.tenantId,
        feedbackCaseId: current.id,
        type: 'case.assigned_to_me',
        data: { assigneeUserId: user.userId } as any,
        createdByUserId: user.userId,
      },
    });

    return updated;
  }

  async listCaseInteractions(user: AuthUser, responseId: string) {
    const response = await this.prisma.surveyResponse.findFirst({
      where: { id: responseId, tenantId: user.tenantId, ...this.unitWhere(user) },
      include: { feedbackCase: true },
    });
    if (!response) throw new NotFoundException();
    if (!response.feedbackCase) return [];
    return this.prisma.customerInteraction.findMany({
      where: { tenantId: user.tenantId, feedbackCaseId: response.feedbackCase.id },
      select: {
        id: true,
        channel: true,
        direction: true,
        outcome: true,
        notes: true,
        createdAt: true,
        createdByUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createCaseInteraction(user: AuthUser, responseId: string, dto: CreateCaseInteractionDto) {
    const response = await this.prisma.surveyResponse.findFirst({
      where: { id: responseId, tenantId: user.tenantId, ...this.unitWhere(user) },
      include: { feedbackCase: true },
    });
    if (!response) throw new NotFoundException();
    const current = response.feedbackCase ?? (await this.createCase(user, responseId));
    if (!current.customerId) throw new BadRequestException('no_customer');

    const channel = dto.channel.trim();
    if (!channel) throw new BadRequestException('invalid_channel');
    const direction = typeof dto.direction === 'string' && dto.direction.trim() ? dto.direction.trim() : 'outbound';
    const outcome = typeof dto.outcome === 'string' && dto.outcome.trim() ? dto.outcome.trim() : null;
    const notes = typeof dto.notes === 'string' && dto.notes.trim() ? dto.notes.trim() : null;

    const interaction = await this.prisma.customerInteraction.create({
      data: {
        tenantId: user.tenantId,
        customerId: current.customerId,
        feedbackCaseId: current.id,
        unitId: current.unitId,
        createdByUserId: user.userId,
        channel,
        direction,
        outcome,
        notes,
      },
      select: {
        id: true,
        channel: true,
        direction: true,
        outcome: true,
        notes: true,
        createdAt: true,
        createdByUser: { select: { id: true, name: true, email: true } },
      },
    });

    await this.prisma.customer.update({
      where: { id: current.customerId },
      data: { lastInteractionAt: new Date() },
    });

    await this.prisma.feedbackCaseEvent.create({
      data: {
        tenantId: user.tenantId,
        feedbackCaseId: current.id,
        type: 'case.contact_logged',
        data: { interactionId: interaction.id, channel, outcome } as any,
        createdByUserId: user.userId,
      },
    });

    return interaction;
  }
}
