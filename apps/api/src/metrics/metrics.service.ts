import { Prisma } from '@prisma/client';
import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { calculateNps } from '../domain/metrics/nps';
import type { AuthUser } from '../auth/auth.types';
import { PermissionCodes } from '../rbac/permission-codes';
import { PrismaService } from '../prisma/prisma.service';
import type { NpsQueryDto } from './dto/nps-query.dto';
import type { CasesQueryDto } from './dto/cases-query.dto';
import type { ReviewsQueryDto } from './dto/reviews-query.dto';
import type { ReviewPlatformCard } from '../units/dto/review-profile.dto';
import { ReviewPlatform, ReviewSentiment, SyncStatus } from '@prisma/client';
import { SentimentService } from '../sentiment/sentiment.service';
import { aggregateSentiment } from '../domain/sentiment/aggregate';
import type { SentimentBackfillDto } from './dto/sentiment-backfill.dto';

function startOfUtcDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function endOfUtcDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

@Injectable()
export class MetricsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sentiment: SentimentService,
  ) {}

  private resolveRange(query: NpsQueryDto) {
    const toInput = query.to ? new Date(query.to) : new Date();
    if (Number.isNaN(toInput.getTime())) throw new BadRequestException('invalid_to');

    const fromInput = query.from
      ? new Date(query.from)
      : new Date(toInput.getTime() - 29 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(fromInput.getTime())) throw new BadRequestException('invalid_from');

    const from = startOfUtcDay(fromInput);
    const to = endOfUtcDay(toInput);

    if (from.getTime() > to.getTime()) throw new BadRequestException('invalid_range');
    if (to.getTime() - from.getTime() > 366 * 24 * 60 * 60 * 1000) throw new BadRequestException('range_too_large');

    return { from, to };
  }

  private async resolveUnitScope(user: AuthUser, unitId?: string) {
    const canSeeAllUnits = user.permissionCodes.includes(PermissionCodes.UnitManage);
    if (canSeeAllUnits) return { canSeeAllUnits: true, unitIds: null as string[] | null, unitId };

    const allowed = user.unitIds.length ? user.unitIds : ['__none__'];
    if (unitId && !allowed.includes(unitId)) throw new ForbiddenException();

    return { canSeeAllUnits: false, unitIds: allowed, unitId };
  }

  async npsSummary(user: AuthUser, query: NpsQueryDto) {
    const { from, to } = this.resolveRange(query);
    const scope = await this.resolveUnitScope(user, query.unitId);

    const rows = await this.prisma.surveyResponse.findMany({
      where: {
        tenantId: user.tenantId,
        status: 'completed',
        npsScore: { not: null },
        completedAt: { gte: from, lte: to },
        ...(scope.unitId
          ? { unitId: scope.unitId }
          : scope.canSeeAllUnits
            ? {}
            : { OR: [{ unitId: { in: scope.unitIds! } }, { unitId: null }] }),
      },
      select: { npsScore: true },
    });

    const scores = rows.map((r) => r.npsScore as number);
    return { from: from.toISOString(), to: to.toISOString(), unitId: scope.unitId ?? null, ...calculateNps(scores) };
  }

  async npsByDay(user: AuthUser, query: NpsQueryDto) {
    const { from, to } = this.resolveRange(query);
    const scope = await this.resolveUnitScope(user, query.unitId);

    const rows = await this.prisma.surveyResponse.findMany({
      where: {
        tenantId: user.tenantId,
        status: 'completed',
        npsScore: { not: null },
        completedAt: { gte: from, lte: to },
        ...(scope.unitId
          ? { unitId: scope.unitId }
          : scope.canSeeAllUnits
            ? {}
            : { OR: [{ unitId: { in: scope.unitIds! } }, { unitId: null }] }),
      },
      select: { npsScore: true, completedAt: true, startedAt: true },
      orderBy: { startedAt: 'asc' },
    });

    const buckets = new Map<string, number[]>();
    for (const r of rows) {
      const key = (r.completedAt ?? r.startedAt).toISOString().slice(0, 10);
      const list = buckets.get(key) ?? [];
      list.push(r.npsScore as number);
      buckets.set(key, list);
    }

    const points = Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, scores]) => ({ date, ...calculateNps(scores) }));

    return { from: from.toISOString(), to: to.toISOString(), unitId: scope.unitId ?? null, points };
  }

  async npsByUnit(user: AuthUser, query: NpsQueryDto) {
    const { from, to } = this.resolveRange(query);
    const scope = await this.resolveUnitScope(user, query.unitId);

    const units = await this.prisma.unit.findMany({
      where: { tenantId: user.tenantId, ...(scope.canSeeAllUnits ? {} : { id: { in: scope.unitIds! } }) },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    const unitById = new Map(units.map((u) => [u.id, u.name]));

    const rows = await this.prisma.surveyResponse.findMany({
      where: {
        tenantId: user.tenantId,
        status: 'completed',
        npsScore: { not: null },
        completedAt: { gte: from, lte: to },
        ...(scope.unitId
          ? { unitId: scope.unitId }
          : scope.canSeeAllUnits
            ? {}
            : { OR: [{ unitId: { in: scope.unitIds! } }, { unitId: null }] }),
      },
      select: { npsScore: true, unitId: true },
    });

    const scoresByUnit = new Map<string, number[]>();
    for (const r of rows) {
      const id = r.unitId ?? '__none__';
      const list = scoresByUnit.get(id) ?? [];
      list.push(r.npsScore as number);
      scoresByUnit.set(id, list);
    }

    const results = Array.from(scoresByUnit.entries()).map(([unitId, scores]) => ({
      unitId: unitId === '__none__' ? null : unitId,
      unitName: unitId === '__none__' ? 'Sem unidade' : (unitById.get(unitId) ?? 'Unidade'),
      ...calculateNps(scores),
    }));

    results.sort((a, b) => (a.unitName ?? '').localeCompare(b.unitName ?? ''));

    return { from: from.toISOString(), to: to.toISOString(), unitId: scope.unitId ?? null, units: results };
  }

  async casesSummary(user: AuthUser, query: CasesQueryDto) {
    const scope = await this.resolveUnitScope(user, query.unitId);
    const unitWhere = scope.unitId
      ? { unitId: scope.unitId }
      : scope.canSeeAllUnits
        ? {}
        : { OR: [{ unitId: { in: scope.unitIds! } }, { unitId: null }] };

    const openStatuses = ['new', 'viewed', 'in_progress', 'waiting_customer'] as const;
    const closedStatuses = ['resolved', 'closed', 'dismissed'] as const;

    const todayStart = startOfUtcDay(new Date());
    const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const next7Start = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    const baseWhere = { tenantId: user.tenantId, ...unitWhere };

    const [
      total,
      open,
      closed,
      unassigned,
      overdue,
      dueToday,
      dueNext7,
      noDue,
      byStatusRows,
      byPriorityRows,
    ] = await this.prisma.$transaction([
      this.prisma.feedbackCase.count({ where: baseWhere }),
      this.prisma.feedbackCase.count({ where: { ...baseWhere, status: { in: [...openStatuses] } } }),
      this.prisma.feedbackCase.count({ where: { ...baseWhere, status: { in: [...closedStatuses] } } }),
      this.prisma.feedbackCase.count({
        where: { ...baseWhere, status: { in: [...openStatuses] }, assigneeUserId: null },
      }),
      this.prisma.feedbackCase.count({
        where: { ...baseWhere, status: { in: [...openStatuses] }, dueAt: { lt: todayStart } },
      }),
      this.prisma.feedbackCase.count({
        where: { ...baseWhere, status: { in: [...openStatuses] }, dueAt: { gte: todayStart, lt: tomorrowStart } },
      }),
      this.prisma.feedbackCase.count({
        where: { ...baseWhere, status: { in: [...openStatuses] }, dueAt: { gte: tomorrowStart, lt: next7Start } },
      }),
      this.prisma.feedbackCase.count({
        where: { ...baseWhere, status: { in: [...openStatuses] }, dueAt: null },
      }),
      this.prisma.feedbackCase.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: { _all: true },
        orderBy: { status: 'asc' },
      } satisfies Prisma.FeedbackCaseGroupByArgs),
      this.prisma.feedbackCase.groupBy({
        by: ['priority'],
        where: baseWhere,
        _count: { _all: true },
        orderBy: { priority: 'asc' },
      } satisfies Prisma.FeedbackCaseGroupByArgs),
    ]);

    const byStatus: Record<string, number> = {};
    for (const r of byStatusRows) byStatus[String(r.status)] = r._count._all;

    const byPriority: Record<string, number> = {};
    for (const r of byPriorityRows) {
      const key = r.priority ? String(r.priority) : 'none';
      byPriority[key] = r._count._all;
    }

    return {
      unitId: scope.unitId ?? null,
      totals: { total, open, closed },
      assignees: { unassigned, assigned: Math.max(0, open - unassigned) },
      due: { overdue, today: dueToday, next7: dueNext7, noDue },
      byStatus,
      byPriority,
    };
  }

  // ======================================================================
  // REVIEWS - Plataformas Externas
  // ======================================================================

  private readonly ALL_PLATFORMS: ReviewPlatform[] = ['google', 'ifood', 'tripadvisor', 'reclameaqui'];

  private resolveRangeReviews(query: ReviewsQueryDto) {
    const toInput = query.to ? new Date(query.to) : new Date();
    if (Number.isNaN(toInput.getTime())) throw new BadRequestException('invalid_to');
    const fromInput = query.from
      ? new Date(query.from)
      : new Date(toInput.getTime() - 29 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(fromInput.getTime())) throw new BadRequestException('invalid_from');
    const from = startOfUtcDay(fromInput);
    const to = endOfUtcDay(toInput);
    if (from.getTime() > to.getTime()) throw new BadRequestException('invalid_range');
    return { from, to };
  }

  private buildReviewsUnitWhere(
    scope: { canSeeAllUnits: boolean; unitIds: string[] | null; unitId?: string | null },
  ): Record<string, unknown> {
    return scope.unitId
      ? { unitId: scope.unitId }
      : scope.canSeeAllUnits
        ? {}
        : { OR: [{ unitId: { in: scope.unitIds! } }, { unitId: null }] };
  }

  private ratingToSentiment(rating: number): ReviewSentiment {
    if (rating >= 4) return 'positive';
    if (rating === 3) return 'neutral';
    return 'negative';
  }

  async reviewsPlatformCards(user: AuthUser, query: ReviewsQueryDto): Promise<{
    from: string; to: string; unitId: string | null; cards: ReviewPlatformCard[];
  }> {
    const { from, to } = this.resolveRangeReviews(query);
    const scope = await this.resolveUnitScope(user, query.unitId);

    const unitWhere = this.buildReviewsUnitWhere(scope);

    const [groupedReviews, profiles] = await Promise.all([
      this.prisma.review.groupBy({
        by: ['platform'],
        where: {
          tenantId: user.tenantId,
          fetchedAt: { gte: from, lte: to },
          ...unitWhere,
          ...(query.platforms?.length ? { platform: { in: query.platforms } } : {}),
          ...(query.sentiments?.length ? { sentiment: { in: query.sentiments } } : {}),
        },
        _avg: { rating: true },
        _count: { _all: true },
      } satisfies Prisma.ReviewGroupByArgs),
      this.prisma.reviewSyncProfile.findMany({
        where: {
          tenantId: user.tenantId,
          ...(scope.unitId
            ? { unitId: scope.unitId }
            : scope.canSeeAllUnits
              ? {}
              : { unitId: { in: scope.unitIds ?? [] } }),
        },
      }),
    ]);

    const byPlatformGroup = new Map(groupedReviews.map((g) => [g.platform, g]));
    const byPlatformProfile = new Map(
      profiles.map((p) => [
        p.platform,
        { lastSyncAt: p.lastSyncAt?.toISOString() ?? null, syncStatus: p.syncStatus, publicUrl: p.publicUrl ?? null },
      ]),
    );

    const cards: ReviewPlatformCard[] = this.ALL_PLATFORMS.map((platform) => {
      const agg = byPlatformGroup.get(platform);
      const profileInfo = byPlatformProfile.get(platform);
      const ratingRaw = agg?._avg.rating;
      const rating = ratingRaw ? Number(Number(ratingRaw).toFixed(1)) : 0;
      return {
        platform,
        averageRating: rating,
        totalReviews: agg?._count._all ?? 0,
        lastSyncAt: profileInfo?.lastSyncAt ?? null,
        syncStatus: profileInfo?.syncStatus ?? ('idle' as SyncStatus),
        publicUrl: profileInfo?.publicUrl ?? null,
      };
    });

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      unitId: scope.unitId ?? null,
      cards,
    };
  }

  async reviewsByUnit(user: AuthUser, query: ReviewsQueryDto) {
    const { from, to } = this.resolveRangeReviews(query);
    const scope = await this.resolveUnitScope(user, query.unitId);
    const unitWhere = this.buildReviewsUnitWhere(scope);

    const units = await this.prisma.unit.findMany({
      where: {
        tenantId: user.tenantId,
        ...(scope.canSeeAllUnits ? {} : { id: { in: scope.unitIds ?? [] } }),
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    const unitById = new Map(units.map((u) => [u.id, u.name]));

    const rows = await this.prisma.review.findMany({
      where: {
        tenantId: user.tenantId,
        fetchedAt: { gte: from, lte: to },
        ...unitWhere,
        ...(query.platforms?.length ? { platform: { in: query.platforms } } : {}),
        ...(query.sentiments?.length ? { sentiment: { in: query.sentiments } } : {}),
      },
      select: { unitId: true, rating: true, platform: true, sentiment: true },
    });

    type Bucket = { ratings: number[]; byPlatform: Record<string, number[]>; bySentiment: Record<string, number> };
    const byUnit = new Map<string, Bucket>();

    for (const r of rows) {
      const id = r.unitId ?? '__none__';
      const b: Bucket = byUnit.get(id) ?? {
        ratings: [],
        byPlatform: { google: [], ifood: [], tripadvisor: [], reclameaqui: [] },
        bySentiment: { positive: 0, neutral: 0, negative: 0 },
      };
      b.ratings.push(r.rating);
      b.byPlatform[r.platform]?.push(r.rating);
      b.bySentiment[r.sentiment] = (b.bySentiment[r.sentiment] ?? 0) + 1;
      byUnit.set(id, b);
    }

    const list = Array.from(byUnit.entries()).map(([unitId, bucket]) => {
      const avg = bucket.ratings.length
        ? Number((bucket.ratings.reduce((a, b) => a + b, 0) / bucket.ratings.length).toFixed(1))
        : 0;
      return {
        unitId: unitId === '__none__' ? null : unitId,
        unitName: unitId === '__none__' ? 'Sem unidade' : (unitById.get(unitId) ?? 'Unidade'),
        averageRating: avg,
        totalReviews: bucket.ratings.length,
        bySentiment: bucket.bySentiment,
        byPlatform: Object.fromEntries(
          Object.entries(bucket.byPlatform).map(([p, list]) => [
            p,
            {
              averageRating: list.length
                ? Number((list.reduce((a, b) => a + b, 0) / list.length).toFixed(1))
                : 0,
              total: list.length,
            },
          ]),
        ),
      };
    });

    list.sort((a, b) => (a.unitName ?? '').localeCompare(b.unitName ?? ''));

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      unitId: scope.unitId ?? null,
      units: list,
    };
  }

  async reviewsFeed(user: AuthUser, query: ReviewsQueryDto) {
    const { from, to } = this.resolveRangeReviews(query);
    const scope = await this.resolveUnitScope(user, query.unitId);
    const unitWhere = this.buildReviewsUnitWhere(scope);

    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    const where = {
      tenantId: user.tenantId,
      fetchedAt: { gte: from, lte: to },
      ...unitWhere,
      ...(query.platforms?.length ? { platform: { in: query.platforms } } : {}),
      ...(query.sentiments?.length ? { sentiment: { in: query.sentiments } } : {}),
    } satisfies Prisma.ReviewWhereInput;

    const [total, rows] = await Promise.all([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        orderBy: { fetchedAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          unit: { select: { id: true, name: true } },
        },
      }),
    ]);

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      unitId: scope.unitId ?? null,
      total,
      limit,
      offset,
      items: rows,
    };
  }

  private responseUnitWhere(scope: {
    canSeeAllUnits: boolean;
    unitIds: string[] | null;
    unitId?: string;
  }): Prisma.SurveyResponseWhereInput {
    if (scope.unitId) return { unitId: scope.unitId };
    if (scope.canSeeAllUnits) return {};
    return { OR: [{ unitId: { in: scope.unitIds! } }, { unitId: null }] };
  }

  async sentimentSummary(user: AuthUser, query: NpsQueryDto) {
    const { from, to } = this.resolveRange(query);
    const scope = await this.resolveUnitScope(user, query.unitId);

    const rows = await this.prisma.surveyResponse.findMany({
      where: {
        tenantId: user.tenantId,
        status: 'completed',
        completedAt: { gte: from, lte: to },
        ...this.responseUnitWhere(scope),
      },
      select: { sentiment: true, sentimentTheme: true },
    });

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      unitId: scope.unitId ?? null,
      groqConfigured: this.sentiment.isGroqConfigured(),
      ...aggregateSentiment(rows),
    };
  }

  async sentimentBackfill(user: AuthUser, dto: SentimentBackfillDto) {
    return this.sentiment.processPendingBatch({
      tenantId: user.tenantId,
      limit: dto.limit ?? 8,
    });
  }
}
