import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingMode, Prisma } from '@prisma/client';
import type { Request } from 'express';
import type Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import { baseDomain } from '../common/tenant-host';
import { StripeService } from './stripe.service';
import {
  subscriptionPriceId,
  tenantPatchFromSubscription,
} from './stripe-subscription-sync';

/** Assinaturas que ainda representam um vínculo vivo com a Stripe. */
const LIVE_SUBSCRIPTION_STATUSES = new Set([
  'trialing',
  'active',
  'past_due',
  'unpaid',
  'paused',
  'incomplete',
]);

/** Status que impedem abrir um novo Checkout (o cliente deve usar o portal). */
const CHECKOUT_BLOCKING_STATUSES = new Set(['trialing', 'active', 'past_due', 'unpaid', 'paused']);

/** A Stripe exige trial_end pelo menos 48h no futuro no Checkout. */
const MIN_CHECKOUT_TRIAL_MS = 48 * 60 * 60 * 1000 + 5 * 60 * 1000;

const SUBSCRIPTION_EVENTS = new Set<string>([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
]);

const INVOICE_EVENTS = new Set<string>(['invoice.paid', 'invoice.payment_failed']);

type WebhookResult = { received: true; duplicate?: boolean; ignored?: boolean };

function stripeId(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  // ---------------------------------------------------------------- checkout

  async createCheckoutSession(user: AuthUser, planSlug: string | undefined, req?: Request) {
    const appUrl = (slug: string) => this.tenantAppUrl(slug, req);
    return this.startCheckout(user.tenantId, user.userId, planSlug, req, (slug) => ({
      success_url: `${appUrl(slug)}/app/company?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl(slug)}/app/company?billing=cancelled`,
    }));
  }

  /**
   * Checkout aberto logo depois do cadastro, ainda sem sessão no painel. A Stripe
   * devolve para o login do subdomínio; o webhook sincroniza a assinatura. O plano
   * e a sessão no retorno servem ao evento de conversão do Meta Pixel.
   */
  async createOnboardingCheckoutSession(
    tenantId: string,
    adminUserId: string,
    planSlug: string | undefined,
    req?: Request,
  ) {
    const appUrl = (slug: string) => this.tenantAppUrl(slug, req, { forceSubdomain: true });
    return this.startCheckout(tenantId, adminUserId, planSlug, req, (slug, plan) => ({
      success_url: `${appUrl(slug)}/login?billing=success&plan=${encodeURIComponent(plan)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl(slug)}/login?billing=cancelled`,
    }));
  }

  private async startCheckout(
    tenantId: string,
    actorUserId: string,
    planSlug: string | undefined,
    req: Request | undefined,
    returnUrls: (slug: string, planSlug: string) => { success_url: string; cancel_url: string },
  ) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      include: { plan: true },
    });
    if (tenant.isPlatform) throw new ForbiddenException('platform_tenant');
    if (tenant.billingMode === BillingMode.manual)
      throw new ConflictException('manual_billing');
    if (
      tenant.stripeSubscriptionId &&
      tenant.stripeSubscriptionStatus &&
      CHECKOUT_BLOCKING_STATUSES.has(tenant.stripeSubscriptionStatus)
    ) {
      throw new ConflictException('subscription_exists');
    }

    const plan = planSlug
      ? await this.prisma.plan.findUnique({ where: { slug: planSlug } })
      : tenant.plan;
    if (!plan) throw new BadRequestException('plan_required');
    if (!plan.isActive) throw new BadRequestException('plan_inactive');
    if (!plan.stripePriceId) throw new BadRequestException('plan_not_billable');

    const stripe = this.stripe.stripe;
    const customerId = await this.ensureCustomer(tenant);

    // Mantém o restante do trial interno: só cobra quando ele acabar.
    const now = Date.now();
    const trialEnd =
      tenant.status === 'trial' &&
      tenant.trialEndsAt &&
      tenant.trialEndsAt.getTime() - now > MIN_CHECKOUT_TRIAL_MS
        ? Math.floor(tenant.trialEndsAt.getTime() / 1000)
        : undefined;

    const metadata = { tenantId: tenant.id, planId: plan.id, planSlug: plan.slug };

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: tenant.id,
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      metadata,
      subscription_data: {
        metadata,
        ...(trialEnd ? { trial_end: trialEnd } : {}),
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      locale: 'pt-BR',
      ...returnUrls(tenant.slug, plan.slug),
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorType: 'user',
      actorUserId,
      action: 'billing.checkout_started',
      entity: 'Tenant',
      entityId: tenant.id,
      summary: { planSlug: plan.slug, sessionId: session.id, trialEnd: trialEnd ?? null },
      req,
    });

    if (!session.url) throw new BadRequestException('checkout_without_url');
    return { url: session.url };
  }

  async createPortalSession(user: AuthUser, req?: Request) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: user.tenantId },
      select: { id: true, slug: true, billingMode: true, stripeCustomerId: true },
    });
    if (tenant.billingMode === BillingMode.manual)
      throw new ConflictException('manual_billing');
    if (!tenant.stripeCustomerId) throw new NotFoundException('no_stripe_customer');

    const session = await this.stripe.stripe.billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      locale: 'pt-BR',
      return_url: `${this.tenantAppUrl(tenant.slug, req)}/app/company`,
    });
    return { url: session.url };
  }

  /**
   * Chamado pela tela de retorno do Checkout. Sincroniza na hora, sem esperar
   * o webhook (que continua sendo a fonte da verdade).
   */
  async syncCheckoutSession(user: AuthUser, sessionId: string) {
    const session = await this.stripe.stripe.checkout.sessions.retrieve(sessionId);
    const sessionTenantId = session.metadata?.tenantId ?? session.client_reference_id;
    if (sessionTenantId !== user.tenantId) throw new ForbiddenException('session_mismatch');
    await this.applyCheckoutSession(session);
    return this.summary(user.tenantId);
  }

  async summary(tenantId: string) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: {
        status: true,
        billingMode: true,
        trialEndsAt: true,
        stripeCustomerId: true,
        stripeSubscriptionStatus: true,
        stripeCurrentPeriodEnd: true,
        stripeCancelAtPeriodEnd: true,
        plan: { select: { id: true, name: true, slug: true, stripePriceId: true } },
      },
    });
    return {
      stripeEnabled: this.stripe.isConfigured(),
      status: tenant.status,
      billingMode: tenant.billingMode,
      trialEndsAt: tenant.trialEndsAt,
      plan: tenant.plan
        ? {
            id: tenant.plan.id,
            name: tenant.plan.name,
            slug: tenant.plan.slug,
            billable: Boolean(tenant.plan.stripePriceId),
          }
        : null,
      hasStripeCustomer: Boolean(tenant.stripeCustomerId),
      subscriptionStatus: tenant.stripeSubscriptionStatus,
      currentPeriodEnd: tenant.stripeCurrentPeriodEnd,
      cancelAtPeriodEnd: tenant.stripeCancelAtPeriodEnd,
      hasLiveSubscription: Boolean(
        tenant.stripeSubscriptionStatus &&
          CHECKOUT_BLOCKING_STATUSES.has(tenant.stripeSubscriptionStatus),
      ),
    };
  }

  // ----------------------------------------------------------------- webhook

  async handleWebhook(rawBody: Buffer | undefined, signature: string | undefined): Promise<WebhookResult> {
    if (!rawBody || !signature) throw new BadRequestException('missing_signature');

    let event: Stripe.Event;
    try {
      event = this.stripe.constructEvent(rawBody, signature);
    } catch (err) {
      if (err instanceof Error && 'type' in err && (err as any).type === 'StripeSignatureVerificationError') {
        throw new BadRequestException('invalid_signature');
      }
      throw err;
    }

    const already = await this.prisma.stripeEvent.findUnique({ where: { id: event.id } });
    if (already) return { received: true, duplicate: true };

    const tenantId = await this.processEvent(event);

    await this.prisma.stripeEvent.createMany({
      data: [{ id: event.id, type: event.type, tenantId }],
      skipDuplicates: true,
    });
    return tenantId === undefined ? { received: true, ignored: true } : { received: true };
  }

  /** Retorna o tenant afetado, null se não achou, undefined se o evento é ignorado. */
  private async processEvent(event: Stripe.Event): Promise<string | null | undefined> {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== 'subscription') return undefined;
      return this.applyCheckoutSession(session);
    }

    if (SUBSCRIPTION_EVENTS.has(event.type)) {
      const sub = event.data.object as Stripe.Subscription;
      return this.syncSubscription(sub.id, { event });
    }

    if (INVOICE_EVENTS.has(event.type)) {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = stripeId(invoice.parent?.subscription_details?.subscription);
      if (!subId) return undefined;
      return this.syncSubscription(subId, { event, invoice });
    }

    return undefined;
  }

  private async applyCheckoutSession(session: Stripe.Checkout.Session) {
    const tenantId = session.metadata?.tenantId ?? session.client_reference_id;
    const subId = stripeId(session.subscription);
    const customerId = stripeId(session.customer);
    if (!tenantId || !subId) {
      this.logger.warn(`checkout ${session.id} sem tenantId/subscription`);
      return null;
    }

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      this.logger.warn(`checkout ${session.id}: tenant ${tenantId} não encontrado`);
      return null;
    }
    if (tenant.billingMode === BillingMode.manual) return tenant.id;

    if (customerId && tenant.stripeCustomerId !== customerId) {
      await this.prisma.tenant.update({
        where: { id: tenant.id },
        data: { stripeCustomerId: customerId },
      });
    }
    return this.syncSubscription(subId, { tenantId: tenant.id, force: true });
  }

  /**
   * Busca a assinatura atualizada na Stripe e grava no tenant. Buscar em vez de
   * confiar no payload evita problemas com eventos fora de ordem.
   */
  private async syncSubscription(
    subscriptionId: string,
    opts: { tenantId?: string; force?: boolean; event?: Stripe.Event; invoice?: Stripe.Invoice },
  ): Promise<string | null> {
    const sub = await this.stripe.stripe.subscriptions.retrieve(subscriptionId);
    const customerId = stripeId(sub.customer);

    const tenant = await this.findTenantForSubscription(sub, customerId, opts.tenantId);
    if (!tenant) {
      this.logger.warn(`assinatura ${sub.id}: tenant não encontrado`);
      return null;
    }
    if (tenant.billingMode === BillingMode.manual) {
      this.logger.warn(`assinatura ${sub.id}: tenant ${tenant.id} é manual, ignorando`);
      return tenant.id;
    }

    // Uma assinatura antiga encerrando não pode derrubar a assinatura atual.
    if (
      !opts.force &&
      tenant.stripeSubscriptionId &&
      tenant.stripeSubscriptionId !== sub.id &&
      tenant.stripeSubscriptionStatus &&
      LIVE_SUBSCRIPTION_STATUSES.has(tenant.stripeSubscriptionStatus) &&
      !LIVE_SUBSCRIPTION_STATUSES.has(sub.status)
    ) {
      return tenant.id;
    }

    const patch = tenantPatchFromSubscription(sub, {
      status: tenant.status,
      activatedAt: tenant.activatedAt,
    });

    const priceId = subscriptionPriceId(sub);
    const plan = priceId
      ? await this.prisma.plan.findFirst({ where: { stripePriceId: priceId }, select: { id: true } })
      : null;

    const data: Prisma.TenantUpdateInput = {
      ...patch,
      ...(customerId && !tenant.stripeCustomerId ? { stripeCustomerId: customerId } : {}),
      ...(plan ? { plan: { connect: { id: plan.id } } } : {}),
    };
    await this.prisma.tenant.update({ where: { id: tenant.id }, data });

    if (patch.status && patch.status !== tenant.status) {
      await this.audit.log({
        tenantId: tenant.id,
        actorType: 'system',
        action: 'billing.status_changed',
        entity: 'Tenant',
        entityId: tenant.id,
        summary: {
          from: tenant.status,
          to: patch.status,
          subscriptionId: sub.id,
          subscriptionStatus: sub.status,
          eventId: opts.event?.id ?? null,
          eventType: opts.event?.type ?? null,
        },
      });
    }
    if (opts.event?.type === 'invoice.payment_failed') {
      await this.audit.log({
        tenantId: tenant.id,
        actorType: 'system',
        action: 'billing.payment_failed',
        entity: 'Tenant',
        entityId: tenant.id,
        summary: {
          invoiceId: opts.invoice?.id ?? null,
          amountDue: opts.invoice?.amount_due ?? null,
          attemptCount: opts.invoice?.attempt_count ?? null,
        },
      });
    }

    return tenant.id;
  }

  private async findTenantForSubscription(
    sub: Stripe.Subscription,
    customerId: string | null,
    tenantId?: string,
  ) {
    const id = tenantId ?? sub.metadata?.tenantId;
    if (id) {
      const byId = await this.prisma.tenant.findUnique({ where: { id } });
      if (byId) return byId;
    }
    const bySub = await this.prisma.tenant.findFirst({ where: { stripeSubscriptionId: sub.id } });
    if (bySub) return bySub;
    if (customerId) {
      return this.prisma.tenant.findFirst({ where: { stripeCustomerId: customerId } });
    }
    return null;
  }

  // ----------------------------------------------------------------- helpers

  private async ensureCustomer(tenant: {
    id: string;
    slug: string;
    tradeName: string;
    legalName: string;
    email: string;
    phone: string | null;
    stripeCustomerId: string | null;
  }) {
    if (tenant.stripeCustomerId) return tenant.stripeCustomerId;

    const customer = await this.stripe.stripe.customers.create(
      {
        name: tenant.legalName || tenant.tradeName,
        email: tenant.email,
        phone: tenant.phone ?? undefined,
        metadata: { tenantId: tenant.id, tenantSlug: tenant.slug },
      },
      { idempotencyKey: `opiina-customer-${tenant.id}` },
    );

    // Só grava se ninguém gravou antes (dois cliques simultâneos).
    const updated = await this.prisma.tenant.updateMany({
      where: { id: tenant.id, stripeCustomerId: null },
      data: { stripeCustomerId: customer.id },
    });
    if (updated.count === 0) {
      const current = await this.prisma.tenant.findUniqueOrThrow({
        where: { id: tenant.id },
        select: { stripeCustomerId: true },
      });
      return current.stripeCustomerId ?? customer.id;
    }
    return customer.id;
  }

  /** URL do painel do tenant, para onde a Stripe devolve o usuário. */
  tenantAppUrl(slug: string, req?: Request, opts: { forceSubdomain?: boolean } = {}) {
    const base = baseDomain();
    const origin = typeof req?.headers?.origin === 'string' ? req.headers.origin : '';
    if (origin && base) {
      try {
        const url = new URL(origin);
        const host = url.hostname.toLowerCase();
        if (host === `${slug}.${base}`) return url.origin;
        if (host === base) {
          // O cadastro roda no domínio raiz, mas o login da empresa fica no subdomínio.
          if (!opts.forceSubdomain) return url.origin;
          url.hostname = `${slug}.${base}`;
          return url.origin;
        }
      } catch {}
    }

    const appBase = (this.config.get<string>('APP_BASE_URL') ?? '').trim();
    if (!appBase) throw new BadRequestException('app_base_url_not_configured');
    const url = new URL(appBase);
    url.hostname = `${slug}.${url.hostname}`;
    return url.origin;
  }
}
