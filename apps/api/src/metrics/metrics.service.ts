import { Prisma } from '@prisma/client';
import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { calculateNps } from '../domain/metrics/nps';
import type { AuthUser } from '../auth/auth.types';
import { PermissionCodes } from '../rbac/permission-codes';
import { PrismaService } from '../prisma/prisma.service';
import type { NpsQueryDto } from './dto/nps-query.dto';
import type { CasesQueryDto } from './dto/cases-query.dto';

function startOfUtcDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function endOfUtcDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

@Injectable()
export class MetricsService {
  constructor(private readonly prisma: PrismaService) {}

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
            : { unitId: { in: scope.unitIds! } }),
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
            : { unitId: { in: scope.unitIds! } }),
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
            : { unitId: { in: scope.unitIds! } }),
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
        : { unitId: { in: scope.unitIds! } };

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
}
