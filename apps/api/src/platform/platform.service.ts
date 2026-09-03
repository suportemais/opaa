import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BillingMode, Prisma, TenantStatus } from '@prisma/client';
import { subscriptionSourceLabel } from '../billing/billing-access';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import type { AccountsQueryDto } from './dto/accounts-query.dto';
import type { ChangePlanDto } from './dto/change-plan.dto';
import type { ExtendTrialDto } from './dto/extend-trial.dto';
import type { GrantAccessDto } from './dto/grant-access.dto';
import type { OverviewQueryDto } from './dto/overview-query.dto';

const CUSTOMER_WHERE = { isPlatform: false } as const;

const accountSelect = {
  id: true,
  slug: true,
  legalName: true,
  tradeName: true,
  email: true,
  status: true,
  billingMode: true,
  planId: true,
  trialEndsAt: true,
  accessValidUntil: true,
  manualAccessReason: true,
  stripeCustomerId: true,
  stripeSubscriptionId: true,
  createdAt: true,
  activatedAt: true,
  suspendedAt: true,
  cancelledAt: true,
  isPlatform: true,
  plan: { select: { id: true, name: true, slug: true } },
  _count: { select: { units: true } },
  users: {
    orderBy: { createdAt: 'asc' as const },
    take: 8,
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      roles: { select: { role: { select: { code: true } } } },
    },
  },
} satisfies Prisma.TenantSelect;

function pickOwner(
  users: Array<{
    id: string;
    name: string;
    email: string;
    roles: Array<{ role: { code: string } }>;
  }>,
) {
  const admin = users.find((u) =>
    u.roles.some((r) => r.role.code === 'tenant_admin'),
  );
  const owner = admin ?? users[0] ?? null;
  return owner ? { id: owner.id, name: owner.name, email: owner.email } : null;
}

function serializeAccount(
  row: Prisma.TenantGetPayload<{ select: typeof accountSelect }>,
) {
  return {
    id: row.id,
    slug: row.slug,
    legalName: row.legalName,
    tradeName: row.tradeName,
    email: row.email,
    status: row.status,
    billingMode: row.billingMode,
    sourceLabel: subscriptionSourceLabel(row.billingMode),
    plan: row.plan
      ? { id: row.plan.id, name: row.plan.name, slug: row.plan.slug }
      : null,
    unitsCount: row._count.units,
    owner: pickOwner(row.users),
    trialEndsAt: row.trialEndsAt,
    accessValidUntil: row.accessValidUntil,
    manualAccessReason: row.manualAccessReason,
    stripeCustomerId: row.stripeCustomerId,
    stripeSubscriptionId: row.stripeSubscriptionId,
    createdAt: row.createdAt,
    activatedAt: row.activatedAt,
    suspendedAt: row.suspendedAt,
    cancelledAt: row.cancelledAt,
  };
}

function startOfUtcDay(d: Date) {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
  );
}

function endOfUtcDay(d: Date) {
  return new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
}

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private resolveOverviewRange(query: OverviewQueryDto) {
    const toInput = query.to ? new Date(query.to) : new Date();
    if (Number.isNaN(toInput.getTime()))
      throw new BadRequestException('invalid_to');
    const fromInput = query.from
      ? new Date(query.from)
      : new Date(toInput.getTime() - 29 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(fromInput.getTime()))
      throw new BadRequestException('invalid_from');
    const from = startOfUtcDay(fromInput);
    const to = endOfUtcDay(toInput);
    if (from.getTime() > to.getTime())
      throw new BadRequestException('invalid_range');
    return { from, to };
  }

  async overview(query: OverviewQueryDto) {
    const { from, to } = this.resolveOverviewRange(query);

    const [activeAccounts, trialAccounts, delinquentAccounts, npsResponses] =
      await Promise.all([
        this.prisma.tenant.count({
          where: { ...CUSTOMER_WHERE, status: TenantStatus.active },
        }),
        this.prisma.tenant.count({
          where: { ...CUSTOMER_WHERE, status: TenantStatus.trial },
        }),
        this.prisma.tenant.count({
          where: { ...CUSTOMER_WHERE, status: TenantStatus.delinquent },
        }),
        this.prisma.surveyResponse.count({
          where: {
            status: 'completed',
            npsScore: { not: null },
            completedAt: { gte: from, lte: to },
            tenant: CUSTOMER_WHERE,
          },
        }),
      ]);

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      kpis: {
        activeAccounts,
        trialAccounts,
        pastDueAccounts: delinquentAccounts,
        pastDueAvailable: true,
        npsResponses,
      },
    };
  }

  async listAccounts(query: AccountsQueryDto) {
    const q = query.q?.trim();
    const rows = await this.prisma.tenant.findMany({
      where: {
        ...CUSTOMER_WHERE,
        ...(q
          ? {
              OR: [
                { tradeName: { contains: q, mode: 'insensitive' } },
                { legalName: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
                { slug: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: accountSelect,
    });
    return rows.map(serializeAccount);
  }

  async getAccount(id: string) {
    const row = await this.prisma.tenant.findFirst({
      where: { id, ...CUSTOMER_WHERE },
      select: accountSelect,
    });
    if (!row) throw new NotFoundException('account_not_found');
    return serializeAccount(row);
  }

  private async requireCustomerAccount(id: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id, ...CUSTOMER_WHERE },
      select: {
        id: true,
        status: true,
        trialEndsAt: true,
        activatedAt: true,
        billingMode: true,
      },
    });
    if (!tenant) throw new NotFoundException('account_not_found');
    return tenant;
  }

  private async requirePlan(planId: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
      select: { id: true, name: true, slug: true, trialDays: true },
    });
    if (!plan) throw new NotFoundException('plan_not_found');
    return plan;
  }

  async changePlan(actor: AuthUser, id: string, dto: ChangePlanDto) {
    await this.requireCustomerAccount(id);
    const plan = await this.requirePlan(dto.planId);
    await this.prisma.tenant.update({
      where: { id },
      data: { planId: plan.id },
    });
    await this.audit.log({
      tenantId: id,
      actorType: 'support',
      actorUserId: actor.userId,
      action: 'platform.account.change_plan',
      entity: 'Tenant',
      entityId: id,
      summary: { planId: plan.id, planSlug: plan.slug },
    });
    return this.getAccount(id);
  }

  async extendTrial(actor: AuthUser, id: string, dto: ExtendTrialDto) {
    const tenant = await this.requireCustomerAccount(id);
    const days = dto.days ?? 14;
    const now = new Date();
    const base =
      tenant.trialEndsAt && tenant.trialEndsAt.getTime() > now.getTime()
        ? tenant.trialEndsAt
        : now;
    const trialEndsAt = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

    await this.prisma.tenant.update({
      where: { id },
      data: { status: TenantStatus.trial, trialEndsAt, suspendedAt: null },
    });
    await this.audit.log({
      tenantId: id,
      actorType: 'support',
      actorUserId: actor.userId,
      action: 'platform.account.extend_trial',
      entity: 'Tenant',
      entityId: id,
      summary: { days, trialEndsAt: trialEndsAt.toISOString() },
    });
    return this.getAccount(id);
  }

  async suspend(actor: AuthUser, id: string) {
    await this.requireCustomerAccount(id);
    const now = new Date();
    await this.prisma.tenant.update({
      where: { id },
      data: { status: TenantStatus.suspended, suspendedAt: now },
    });
    await this.audit.log({
      tenantId: id,
      actorType: 'support',
      actorUserId: actor.userId,
      action: 'platform.account.suspend',
      entity: 'Tenant',
      entityId: id,
    });
    return this.getAccount(id);
  }

  async reactivate(actor: AuthUser, id: string) {
    const tenant = await this.requireCustomerAccount(id);
    const now = new Date();
    await this.prisma.tenant.update({
      where: { id },
      data: {
        status: TenantStatus.active,
        suspendedAt: null,
        activatedAt: tenant.activatedAt ?? now,
      },
    });
    await this.audit.log({
      tenantId: id,
      actorType: 'support',
      actorUserId: actor.userId,
      action: 'platform.account.reactivate',
      entity: 'Tenant',
      entityId: id,
    });
    return this.getAccount(id);
  }

  async grantAccess(actor: AuthUser, id: string, dto: GrantAccessDto) {
    await this.requireCustomerAccount(id);
    const plan = await this.requirePlan(dto.planId);

    let accessValidUntil: Date | null = null;
    if (dto.accessValidUntil) {
      const parsed = new Date(dto.accessValidUntil);
      if (Number.isNaN(parsed.getTime()))
        throw new BadRequestException('invalid_access_valid_until');
      accessValidUntil = parsed;
    } else if (dto.accessValidUntil === null) {
      accessValidUntil = null;
    }

    const now = new Date();
    await this.prisma.tenant.update({
      where: { id },
      data: {
        billingMode: BillingMode.manual,
        planId: plan.id,
        accessValidUntil,
        manualAccessReason: dto.reason,
        status: TenantStatus.active,
        activatedAt: now,
        suspendedAt: null,
      },
    });
    await this.audit.log({
      tenantId: id,
      actorType: 'support',
      actorUserId: actor.userId,
      action: 'platform.account.grant_access',
      entity: 'Tenant',
      entityId: id,
      summary: {
        planId: plan.id,
        planSlug: plan.slug,
        reason: dto.reason,
        accessValidUntil: accessValidUntil?.toISOString() ?? null,
      },
    });
    return this.getAccount(id);
  }

  async listSubscriptions() {
    const rows = await this.prisma.tenant.findMany({
      where: CUSTOMER_WHERE,
      orderBy: { createdAt: 'desc' },
      select: accountSelect,
    });

    return rows.map((row) => {
      const account = serializeAccount(row);
      return {
        id: account.id,
        tenantId: account.id,
        tenantName: account.tradeName,
        tenantSlug: account.slug,
        plan: account.plan,
        status: account.status,
        billingMode: account.billingMode,
        source: account.billingMode === 'manual' ? 'manual' : 'stripe',
        sourceLabel: account.sourceLabel,
        validUntil:
          account.billingMode === 'manual'
            ? account.accessValidUntil
            : account.trialEndsAt,
        trialEndsAt: account.trialEndsAt,
        accessValidUntil: account.accessValidUntil,
        stripeSubscriptionId: account.stripeSubscriptionId,
        createdAt: account.createdAt,
      };
    });
  }

  listPlans() {
    return this.prisma.plan.findMany({
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }
}
