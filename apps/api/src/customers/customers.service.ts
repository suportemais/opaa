import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionCodes } from '../rbac/permission-codes';
import { normalizeEmail, normalizePhone } from '../common/normalize';
import type { UpdateCustomerDto } from './dto/update-customer.dto';
import type { CreateCustomerInteractionDto } from './dto/create-customer-interaction.dto';
import type { CreateCustomerDto } from './dto/create-customer.dto';
import { Prisma } from '@prisma/client';
import {
  CUSTOMER_SOURCES,
  marketingOffersConsentData,
  parseBirthDate,
  type CustomerSource,
} from '../domain/customers/offers';
import {
  matchImportedUnits,
  parseContactImportRows,
  type ContactImportRow,
} from '../domain/customers/import-contacts';

const customerOriginUnitSelect = {
  originUnit: { select: { id: true, name: true } },
} as const;

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  private unitScopeWhere(user: AuthUser) {
    const canSeeAllUnits = user.permissionCodes.includes(
      PermissionCodes.UnitManage,
    );
    if (canSeeAllUnits) return {};
    const allowed = user.unitIds.length ? user.unitIds : ['__none__'];
    return { originUnitId: { in: allowed } };
  }

  private responseUnitScopeWhere(user: AuthUser) {
    const canSeeAllUnits = user.permissionCodes.includes(
      PermissionCodes.UnitManage,
    );
    if (canSeeAllUnits) return {};
    const allowed = user.unitIds.length ? user.unitIds : ['__none__'];
    return { unitId: { in: allowed } };
  }

  async importFromCsv(user: AuthUser, rows: Array<Record<string, string>>) {
    if (!user.permissionCodes.includes(PermissionCodes.CustomerManage)) {
      throw new ForbiddenException();
    }

    const parsed = parseContactImportRows(rows);
    const fatal = parsed.errors.find((e) => e.row === 0);
    if (fatal) throw new BadRequestException(fatal.message);

    const units = await this.listImportableUnits(user);
    const persistErrors = [...parsed.errors];
    let created = 0;
    let updated = 0;

    for (const row of parsed.rows) {
      const matches = matchImportedUnits(row.unitLabel, units);
      if (matches.length === 0) {
        persistErrors.push({
          row: row.lineNumber,
          message: 'Unidade não encontrada',
        });
        continue;
      }
      if (matches.length > 1) {
        persistErrors.push({
          row: row.lineNumber,
          message: 'Unidade ambígua',
        });
        continue;
      }
      try {
        const result = await this.upsertImportedContact(
          user.tenantId,
          row,
          matches[0].id,
        );
        if (result === 'created') created += 1;
        else updated += 1;
      } catch {
        persistErrors.push({
          row: row.lineNumber,
          message: 'Falha ao importar contato',
        });
      }
    }

    return {
      imported: created,
      created,
      updated,
      total: rows.length,
      errors: persistErrors,
    };
  }

  private async listImportableUnits(user: AuthUser) {
    const canSeeAllUnits = user.permissionCodes.includes(
      PermissionCodes.UnitManage,
    );
    const allowed = user.unitIds.length ? user.unitIds : ['__none__'];
    return this.prisma.unit.findMany({
      where: {
        tenantId: user.tenantId,
        status: 'active',
        ...(canSeeAllUnits ? {} : { id: { in: allowed } }),
      },
      select: { id: true, name: true, internalCode: true, document: true },
    });
  }

  private async upsertImportedContact(
    tenantId: string,
    row: ContactImportRow,
    originUnitId: string,
  ): Promise<'created' | 'updated'> {
    const emailNormalized = row.email ? normalizeEmail(row.email) : null;
    const phoneNormalized = row.phone ? normalizePhone(row.phone) : null;
    const documentNormalized = row.document;

    const existing =
      emailNormalized || phoneNormalized || documentNormalized
        ? await this.prisma.customer.findFirst({
            where: {
              tenantId,
              OR: [
                ...(emailNormalized ? [{ emailNormalized }] : []),
                ...(phoneNormalized ? [{ phoneNormalized }] : []),
                ...(documentNormalized ? [{ documentNormalized }] : []),
              ],
            },
          })
        : null;

    const now = new Date();
    if (existing) {
      await this.prisma.customer.update({
        where: { id: existing.id },
        data: {
          name: row.name || existing.name,
          email: row.email ?? existing.email,
          emailNormalized: emailNormalized ?? existing.emailNormalized,
          phone: row.phone ?? existing.phone,
          phoneNormalized: phoneNormalized ?? existing.phoneNormalized,
          documentNormalized: documentNormalized ?? existing.documentNormalized,
          notes: row.notes ?? existing.notes,
          ...(row.birthDate ? { birthDate: row.birthDate } : {}),
          lastInteractionAt: now,
          originUnitId,
        },
      });
      if (typeof row.acceptsOffers === 'boolean') {
        await this.recordOffersConsent(tenantId, existing.id, row.acceptsOffers, 'import');
      }
      return 'updated';
    }

    const created = await this.prisma.customer.create({
      data: {
        source: 'import',
        ...(row.birthDate ? { birthDate: row.birthDate } : {}),
        tenantId,
        name: row.name,
        email: row.email,
        emailNormalized: emailNormalized ?? undefined,
        phone: row.phone,
        phoneNormalized: phoneNormalized ?? undefined,
        documentNormalized: documentNormalized ?? undefined,
        notes: row.notes,
        originUnitId,
        firstInteractionAt: now,
        lastInteractionAt: now,
        status: 'active',
      },
    });
    if (typeof row.acceptsOffers === 'boolean') {
      await this.recordOffersConsent(tenantId, created.id, row.acceptsOffers, 'import');
    }
    return 'created';
  }

  /**
   * Registra um novo CustomerConsent (histórico; nunca altera os anteriores) e
   * espelha o valor em Customer.acceptsOffers para filtros/listagem.
   */
  private async recordOffersConsent(
    tenantId: string,
    customerId: string,
    granted: boolean,
    source: CustomerSource,
  ) {
    const at = new Date();
    await this.prisma.$transaction([
      this.prisma.customerConsent.create({
        data: marketingOffersConsentData({ tenantId, customerId, granted, source, at }),
      }),
      this.prisma.customer.update({
        where: { id: customerId },
        data: { acceptsOffers: granted, acceptsOffersAt: at },
      }),
    ]);
  }

  async list(
    user: AuthUser,
    q?: string,
    filters: {
      unitId?: string;
      offers?: string;
      birthdayMonth?: string;
      source?: string;
      page?: string;
      pageSize?: string;
    } = {},
  ) {
    const query = typeof q === 'string' ? q.trim() : '';
    const qEmail = query.includes('@') ? normalizeEmail(query) : null;
    const qPhone = query ? normalizePhone(query) : null;

    const and: Prisma.CustomerWhereInput[] = [];

    if (filters.unitId) {
      const canSeeAllUnits = user.permissionCodes.includes(PermissionCodes.UnitManage);
      if (!canSeeAllUnits && !user.unitIds.includes(filters.unitId)) {
        throw new ForbiddenException();
      }
      and.push({ originUnitId: filters.unitId });
    }

    if (filters.offers === 'sim') and.push({ acceptsOffers: true });
    else if (filters.offers === 'nao') {
      and.push({ OR: [{ acceptsOffers: false }, { acceptsOffers: null }] });
    } else if (filters.offers && filters.offers !== 'any') {
      throw new BadRequestException('invalid_offers');
    }

    if (filters.source) {
      if (!(CUSTOMER_SOURCES as readonly string[]).includes(filters.source)) {
        throw new BadRequestException('invalid_source');
      }
      and.push({ source: filters.source });
    }

    if (filters.birthdayMonth) {
      const month = Number(filters.birthdayMonth);
      if (!Number.isInteger(month) || month < 1 || month > 12) {
        throw new BadRequestException('invalid_birthday_month');
      }
      const ids = await this.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "customers"
        WHERE "tenantId" = ${user.tenantId}::uuid
          AND "birthDate" IS NOT NULL
          AND EXTRACT(MONTH FROM "birthDate") = ${month}
      `;
      and.push({ id: { in: ids.map((r) => r.id) } });
    }

    const where: Prisma.CustomerWhereInput = {
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
      ...(and.length ? { AND: and } : {}),
    };
    const orderBy: Prisma.CustomerOrderByWithRelationInput[] = [
      { lastInteractionAt: 'desc' },
      { createdAt: 'desc' },
    ];

    // Formato antigo (array, até 200) quando `page` não é enviado.
    if (filters.page === undefined || filters.page === '') {
      return this.prisma.customer.findMany({
        where,
        include: customerOriginUnitSelect,
        orderBy,
        take: 200,
      });
    }

    const page = Math.max(1, Math.floor(Number(filters.page)) || 1);
    const pageSize = Math.min(
      200,
      Math.max(1, Math.floor(Number(filters.pageSize ?? 50)) || 50),
    );
    const [total, items] = await this.prisma.$transaction([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        include: customerOriginUnitSelect,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items, total, page, pageSize };
  }

  async create(user: AuthUser, dto: CreateCustomerDto) {
    if (!user.permissionCodes.includes(PermissionCodes.CustomerManage)) {
      throw new ForbiddenException();
    }
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('invalid_name');

    let originUnitId = await this.resolveOriginUnitId(user, dto.originUnitId);
    if (originUnitId === undefined) {
      const canSeeAllUnits = user.permissionCodes.includes(PermissionCodes.UnitManage);
      if (!canSeeAllUnits) {
        if (user.unitIds.length !== 1) throw new BadRequestException('origin_unit_required');
        originUnitId = await this.resolveOriginUnitId(user, user.unitIds[0]);
      }
    }

    const email = typeof dto.email === 'string' && dto.email.trim() ? dto.email.trim() : null;
    const phone = typeof dto.phone === 'string' && dto.phone.trim() ? dto.phone.trim() : null;
    const emailNormalized = email ? normalizeEmail(email) : null;
    const phoneNormalized = phone ? normalizePhone(phone) : null;

    let birthDate: Date | null = null;
    if (typeof dto.birthDate === 'string' && dto.birthDate.trim()) {
      birthDate = parseBirthDate(dto.birthDate);
      if (!birthDate) throw new BadRequestException('invalid_birth_date');
    }

    if (emailNormalized || phoneNormalized) {
      const existing = await this.prisma.customer.findFirst({
        where: {
          tenantId: user.tenantId,
          OR: [
            ...(emailNormalized ? [{ emailNormalized }] : []),
            ...(phoneNormalized ? [{ phoneNormalized }] : []),
          ],
        },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException({ code: 'customer_exists', id: existing.id });
      }
    }

    const notes = typeof dto.notes === 'string' && dto.notes.trim() ? dto.notes.trim() : null;
    const created = await this.prisma.customer.create({
      data: {
        tenantId: user.tenantId,
        name,
        email,
        emailNormalized,
        phone,
        phoneNormalized,
        birthDate,
        notes,
        originUnitId: originUnitId ?? null,
        source: 'manual',
        status: 'active',
      },
      select: { id: true },
    });

    if (typeof dto.acceptsOffers === 'boolean') {
      await this.recordOffersConsent(user.tenantId, created.id, dto.acceptsOffers, 'manual');
    }

    return this.get(user, created.id);
  }

  async get(user: AuthUser, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId: user.tenantId, ...this.unitScopeWhere(user) },
      include: customerOriginUnitSelect,
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
        surveyResponse: {
          select: { id: true, npsScore: true, npsClass: true },
        },
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

  async createInteraction(
    user: AuthUser,
    customerId: string,
    dto: CreateCustomerInteractionDto,
  ) {
    await this.get(user, customerId);
    if (!user.permissionCodes.includes(PermissionCodes.CustomerManage)) {
      throw new ForbiddenException();
    }

    const channel = dto.channel.trim();
    if (!channel) throw new BadRequestException('invalid_channel');

    const direction =
      typeof dto.direction === 'string' && dto.direction.trim()
        ? dto.direction.trim()
        : 'outbound';
    const outcome =
      typeof dto.outcome === 'string' && dto.outcome.trim()
        ? dto.outcome.trim()
        : null;
    const notes =
      typeof dto.notes === 'string' && dto.notes.trim()
        ? dto.notes.trim()
        : null;

    const unitId =
      typeof dto.unitId === 'string' && dto.unitId.trim()
        ? dto.unitId.trim()
        : null;

    const canSeeAllUnits = user.permissionCodes.includes(
      PermissionCodes.UnitManage,
    );
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

    const originUnitId = await this.resolveOriginUnitId(user, dto.originUnitId);

    const email =
      typeof dto.email === 'string' && dto.email.trim()
        ? dto.email.trim()
        : undefined;
    const phone =
      typeof dto.phone === 'string' && dto.phone.trim()
        ? dto.phone.trim()
        : undefined;
    const notes = typeof dto.notes === 'string' ? dto.notes.trim() : undefined;
    const tags =
      Array.isArray(dto.tags) && dto.tags.length
        ? dto.tags
            .map((t) => t.trim())
            .filter((t) => t.length > 0)
            .slice(0, 20)
        : dto.tags
          ? []
          : undefined;

    const doNotContact =
      typeof dto.doNotContact === 'boolean' ? dto.doNotContact : undefined;
    const doNotContactReason =
      typeof dto.doNotContactReason === 'string' &&
      dto.doNotContactReason.trim()
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

    let birthDate: Date | null | undefined;
    if (typeof dto.birthDate === 'string') {
      if (!dto.birthDate.trim()) birthDate = null;
      else {
        birthDate = parseBirthDate(dto.birthDate);
        if (!birthDate) throw new BadRequestException('invalid_birth_date');
      }
    }

    if (typeof dto.acceptsOffers === 'boolean') {
      await this.recordOffersConsent(user.tenantId, customer.id, dto.acceptsOffers, 'manual');
    }

    return this.prisma.customer.update({
      where: { id: customer.id },
      data: {
        birthDate,
        name:
          typeof dto.name === 'string' ? dto.name.trim() || null : undefined,
        // Só altera e-mail/telefone quando o campo foi enviado (PATCH parcial
        // não pode apagar dados). Enviar string vazia continua limpando.
        ...(dto.email !== undefined
          ? {
              email: email ?? null,
              emailNormalized: email ? normalizeEmail(email) : null,
            }
          : {}),
        ...(dto.phone !== undefined
          ? {
              phone: phone ?? null,
              phoneNormalized: phone ? normalizePhone(phone) : null,
            }
          : {}),
        originUnitId: originUnitId !== undefined ? originUnitId : undefined,
        notes: notes !== undefined ? (notes.length ? notes : null) : undefined,
        tags: tags !== undefined ? (tags as any) : undefined,
        doNotContact,
        doNotContactReason: doNotContact === false ? null : doNotContactReason,
        doNotContactAt,
      },
      include: customerOriginUnitSelect,
    });
  }

  private async resolveOriginUnitId(
    user: AuthUser,
    raw?: string,
  ): Promise<string | undefined> {
    if (typeof raw !== 'string' || !raw.trim()) return undefined;
    const originUnitId = raw.trim();
    const canSeeAllUnits = user.permissionCodes.includes(
      PermissionCodes.UnitManage,
    );
    if (!canSeeAllUnits && !user.unitIds.includes(originUnitId)) {
      throw new ForbiddenException();
    }
    const unit = await this.prisma.unit.findFirst({
      where: {
        id: originUnitId,
        tenantId: user.tenantId,
        status: 'active',
      },
      select: { id: true },
    });
    if (!unit) throw new BadRequestException('invalid_origin_unit');
    return unit.id;
  }
}
