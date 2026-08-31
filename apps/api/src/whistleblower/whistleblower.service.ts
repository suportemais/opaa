import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { WhistleblowerCategory, WhistleblowerPriority, WhistleblowerStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth.types';
import { PermissionCodes } from '../rbac/permission-codes';
import type { UpdateWhistleblowerDto } from './dto/update-whistleblower.dto';
import type { CreateWhistleblowerEventDto } from './dto/update-whistleblower.dto';

@Injectable()
export class WhistleblowerService {
  constructor(private readonly prisma: PrismaService) {}

  private unitWhere(user: AuthUser) {
    const canSeeAll = user.permissionCodes.includes(PermissionCodes.UnitManage);
    if (canSeeAll) return {};
    const allowed = user.unitIds.length ? user.unitIds : ['__none__'];
    return { OR: [{ unitId: { in: allowed } }, { unitId: null }] };
  }

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

  list(
    user: AuthUser,
    params: {
      cursor?: string;
      take?: string;
      status?: string;
      priority?: string;
      category?: string;
      from?: string;
      to?: string;
      unitId?: string;
      q?: string;
      identified?: string;
    },
  ) {
    const take = Math.min(Math.max(params.take ? Number(params.take) : 50, 1), 200);
    const canSeeAllUnits = user.permissionCodes.includes(PermissionCodes.UnitManage);
    if (params.unitId && !canSeeAllUnits) {
      if (!user.unitIds.includes(params.unitId)) throw new ForbiddenException();
    }

    const allowedStatus: WhistleblowerStatus[] = ['received', 'analyzing', 'investigating', 'awaiting_info', 'completed', 'archived'];
    let statusFilter: WhistleblowerStatus | undefined;
    if (params.status && params.status !== 'any') {
      if (!allowedStatus.includes(params.status as WhistleblowerStatus)) throw new BadRequestException('invalid_status');
      statusFilter = params.status as WhistleblowerStatus;
    }

    const allowedPriority: WhistleblowerPriority[] = ['low', 'medium', 'high', 'critical'];
    let priorityFilter: WhistleblowerPriority | undefined;
    if (params.priority && params.priority !== 'any') {
      if (!allowedPriority.includes(params.priority as WhistleblowerPriority)) throw new BadRequestException('invalid_priority');
      priorityFilter = params.priority as WhistleblowerPriority;
    }

    const allowedCategory: WhistleblowerCategory[] = [
      'moral_harassment', 'sexual_harassment', 'discrimination', 'racism', 'fraud', 'corruption',
      'conflict_of_interest', 'policy_violation', 'work_safety', 'lgpd_privacy', 'misconduct', 'other',
    ];
    let categoryFilter: WhistleblowerCategory | undefined;
    if (params.category && params.category !== 'any') {
      if (!allowedCategory.includes(params.category as WhistleblowerCategory)) throw new BadRequestException('invalid_category');
      categoryFilter = params.category as WhistleblowerCategory;
    }
    const range = this.resolveRange(params);

    const q = params.q?.trim();
    const unitWhere = params.unitId ? { unitId: params.unitId } : this.unitWhere(user);

    let identified: boolean | undefined;
    if (params.identified === 'identified') identified = true;
    else if (params.identified === 'anonymous') identified = false;

    const searchWhere: Record<string, unknown> | undefined = q
      ? {
          OR: [
            { protocol: { contains: q, mode: 'insensitive' } },
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            { reporterName: { contains: q, mode: 'insensitive' } },
            { reporterEmail: { contains: q, mode: 'insensitive' } },
          ],
        }
      : undefined;

    return this.prisma.whistleblowerReport.findMany({
      where: {
        tenantId: user.tenantId,
        ...unitWhere,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(priorityFilter ? { priority: priorityFilter } : {}),
        ...(categoryFilter ? { category: categoryFilter } : {}),
        ...(identified === true ? { reporterAnonymous: false } : {}),
        ...(identified === false ? { reporterAnonymous: true } : {}),
        ...(range ? { createdAt: { gte: range.from, lte: range.to } } : {}),
        ...(searchWhere ?? {}),
      },
      take,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(params.cursor ? { skip: 1, cursor: { id: params.cursor } } : {}),
      include: {
        unit: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async detail(user: AuthUser, id: string) {
    const row = await this.prisma.whistleblowerReport.findFirst({
      where: { id, tenantId: user.tenantId, ...this.unitWhere(user) },
      include: {
        unit: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, email: true } },
        events: {
          orderBy: { createdAt: 'asc' },
          include: {
            createdBy: { select: { id: true, name: true, email: true } },
            assignee: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
    if (!row) throw new NotFoundException('whistleblower_not_found');
    return row;
  }

  async update(user: AuthUser, id: string, dto: UpdateWhistleblowerDto) {
    const existing = await this.prisma.whistleblowerReport.findFirst({
      where: { id, tenantId: user.tenantId, ...this.unitWhere(user) },
      select: { id: true, status: true, priority: true, assigneeUserId: true, customCategory: true },
    });
    if (!existing) throw new NotFoundException('whistleblower_not_found');

    return this.prisma.$transaction(async (tx) => {
      const updatePayload: Record<string, unknown> = {};
      const events: Array<Record<string, unknown>> = [];

      if (dto.status && dto.status !== existing.status) {
        updatePayload.status = dto.status;
        events.push({
          tenantId: user.tenantId,
          reportId: existing.id,
          type: 'status_changed',
          fromStatus: existing.status,
          toStatus: dto.status,
          notes: dto.notes?.trim() || undefined,
          createdById: user.userId,
        });
      } else if (dto.notes?.trim()) {
        events.push({
          tenantId: user.tenantId,
          reportId: existing.id,
          type: 'notes',
          notes: dto.notes.trim(),
          createdById: user.userId,
        });
      }

      if (dto.priority && dto.priority !== existing.priority) {
        updatePayload.priority = dto.priority;
        if (!events.some((e) => e.type === 'priority_changed')) {
          events.push({
            tenantId: user.tenantId,
            reportId: existing.id,
            type: 'priority_changed',
            notes: dto.notes?.trim() || undefined,
            createdById: user.userId,
          });
        }
      }

      if (Object.prototype.hasOwnProperty.call(dto, 'assigneeUserId')) {
        if (dto.assigneeUserId !== existing.assigneeUserId) {
          updatePayload.assigneeUserId = dto.assigneeUserId ?? null;
          events.push({
            tenantId: user.tenantId,
            reportId: existing.id,
            type: 'assignee_changed',
            assigneeUserId: dto.assigneeUserId ?? null,
            notes: dto.notes?.trim() || undefined,
            createdById: user.userId,
          });
        }
      }

      if (dto.customCategory !== undefined && dto.customCategory !== existing.customCategory) {
        updatePayload.customCategory = dto.customCategory?.trim() || null;
      }

      if (Object.keys(updatePayload).length === 0 && events.length === 0) {
        return this.detail(user, existing.id);
      }

      if (Object.keys(updatePayload).length > 0) {
        await tx.whistleblowerReport.update({ where: { id: existing.id }, data: updatePayload });
      }

      if (events.length) {
        await tx.whistleblowerReportEvent.createMany({ data: events as any });
      }

      return this.detail(user, existing.id);
    });
  }

  async addEvent(user: AuthUser, id: string, dto: CreateWhistleblowerEventDto) {
    const existing = await this.prisma.whistleblowerReport.findFirst({
      where: { id, tenantId: user.tenantId, ...this.unitWhere(user) },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('whistleblower_not_found');

    await this.prisma.whistleblowerReportEvent.create({
      data: {
        tenantId: user.tenantId,
        reportId: existing.id,
        type: 'comment',
        notes: dto.notes.trim(),
        createdById: user.userId,
      },
    });

    return this.detail(user, existing.id);
  }
}
