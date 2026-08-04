import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionCodes } from '../rbac/permission-codes';
import { normalizeEmail, normalizePhone } from '../common/normalize';
import type { UpdateCustomerDto } from './dto/update-customer.dto';
import type { CreateCustomerInteractionDto } from './dto/create-customer-interaction.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  private unitScopeWhere(user: AuthUser) {
    const canSeeAllUnits = user.permissionCodes.includes(PermissionCodes.UnitManage);
    if (canSeeAllUnits) return {};
    const allowed = user.unitIds.length ? user.unitIds : ['__none__'];
    return { originUnitId: { in: allowed } };
  }

  private responseUnitScopeWhere(user: AuthUser) {
    const canSeeAllUnits = user.permissionCodes.includes(PermissionCodes.UnitManage);
    if (canSeeAllUnits) return {};
    const allowed = user.unitIds.length ? user.unitIds : ['__none__'];
    return { unitId: { in: allowed } };
  }

  async list(user: AuthUser, q?: string) {
    const query = typeof q === 'string' ? q.trim() : '';
    const qEmail = query.includes('@') ? normalizeEmail(query) : null;
    const qPhone = query ? normalizePhone(query) : null;

    return this.prisma.customer.findMany({
      where: {
        tenantId: user.tenantId,
        ...this.unitScopeWhere(user),
        ...(query
          ? {
              OR: [
                { name: { contains: query } },
                ...(qEmail ? [{ emailNormalized: { contains: qEmail } }] : []),
                ...(qPhone ? [{ phoneNormalized: { contains: qPhone } }] : []),
              ],
            }
          : {}),
      },
      orderBy: [{ lastInteractionAt: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });
  }

  async get(user: AuthUser, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId: user.tenantId, ...this.unitScopeWhere(user) },
    });
    if (!customer) throw new NotFoundException();
    return customer;
  }

  async listResponses(user: AuthUser, customerId: string) {
    await this.get(user, customerId);
    return this.prisma.surveyResponse.findMany({
      where: {
        tenantId: user.tenantId,
        customerId,
        status: 'completed',
        ...this.responseUnitScopeWhere(user),
      },
      select: {
        id: true,
        startedAt: true,
        completedAt: true,
        npsScore: true,
        npsClass: true,
        mainComment: true,
        survey: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true } },
      },
      orderBy: { completedAt: 'desc' },
      take: 200,
    });
  }

  async listCases(user: AuthUser, customerId: string) {
    await this.get(user, customerId);
    return this.prisma.feedbackCase.findMany({
      where: {
        tenantId: user.tenantId,
        customerId,
        ...this.responseUnitScopeWhere(user),
      },
      select: {
        id: true,
        status: true,
        priority: true,
        updatedAt: true,
        createdAt: true,
        description: true,
        unit: { select: { id: true, name: true } },
        surveyResponse: { select: { id: true, npsScore: true, npsClass: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
  }

  async listInteractions(user: AuthUser, customerId: string) {
    await this.get(user, customerId);
    return this.prisma.customerInteraction.findMany({
      where: {
        tenantId: user.tenantId,
        customerId,
        ...this.responseUnitScopeWhere(user),
      },
      select: {
        id: true,
        channel: true,
        direction: true,
        outcome: true,
        notes: true,
        createdAt: true,
        unit: { select: { id: true, name: true } },
        createdByUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async createInteraction(user: AuthUser, customerId: string, dto: CreateCustomerInteractionDto) {
    await this.get(user, customerId);
    if (!user.permissionCodes.includes(PermissionCodes.CustomerManage)) {
      throw new ForbiddenException();
    }

    const channel = dto.channel.trim();
    if (!channel) throw new BadRequestException('invalid_channel');

    const direction = typeof dto.direction === 'string' && dto.direction.trim() ? dto.direction.trim() : 'outbound';
    const outcome = typeof dto.outcome === 'string' && dto.outcome.trim() ? dto.outcome.trim() : null;
    const notes = typeof dto.notes === 'string' && dto.notes.trim() ? dto.notes.trim() : null;

    const unitId =
      typeof dto.unitId === 'string' && dto.unitId.trim()
        ? dto.unitId.trim()
        : null;

    const canSeeAllUnits = user.permissionCodes.includes(PermissionCodes.UnitManage);
    if (!canSeeAllUnits && unitId && !user.unitIds.includes(unitId)) {
      throw new ForbiddenException();
    }

    return this.prisma.customerInteraction.create({
      data: {
        tenantId: user.tenantId,
        customerId,
        unitId,
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
        unit: { select: { id: true, name: true } },
        createdByUser: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async update(user: AuthUser, id: string, dto: UpdateCustomerDto) {
    const customer = await this.get(user, id);

    if (!user.permissionCodes.includes(PermissionCodes.CustomerManage)) {
      throw new ForbiddenException();
    }

    const email = typeof dto.email === 'string' && dto.email.trim() ? dto.email.trim() : undefined;
    const phone = typeof dto.phone === 'string' && dto.phone.trim() ? dto.phone.trim() : undefined;
    const notes = typeof dto.notes === 'string' ? dto.notes.trim() : undefined;
    const tags =
      Array.isArray(dto.tags) && dto.tags.length
        ? dto.tags.map((t) => t.trim()).filter((t) => t.length > 0).slice(0, 20)
        : dto.tags
          ? []
          : undefined;

    const doNotContact = typeof dto.doNotContact === 'boolean' ? dto.doNotContact : undefined;
    const doNotContactReason =
      typeof dto.doNotContactReason === 'string' && dto.doNotContactReason.trim()
        ? dto.doNotContactReason.trim()
        : dto.doNotContactReason
          ? null
          : undefined;

    const doNotContactAt =
      doNotContact === true
        ? customer.doNotContact
          ? customer.doNotContactAt
          : new Date()
        : doNotContact === false
          ? null
          : undefined;

    return this.prisma.customer.update({
      where: { id: customer.id },
      data: {
        name: typeof dto.name === 'string' ? dto.name.trim() || null : undefined,
        email: email ?? null,
        emailNormalized: email ? normalizeEmail(email) : null,
        phone: phone ?? null,
        phoneNormalized: phone ? normalizePhone(phone) : null,
        notes: notes !== undefined ? (notes.length ? notes : null) : undefined,
        tags: tags !== undefined ? (tags as any) : undefined,
        doNotContact,
        doNotContactReason: doNotContact === false ? null : doNotContactReason,
        doNotContactAt,
      },
    });
  }
}
