import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantStatus } from '@prisma/client';
import { BillingService } from './billing.service';
import { StripeService } from './stripe.service';

const WEBHOOK_SECRET = 'whsec_test_secret';

type TenantRow = Record<string, any>;

function makePrisma(tenants: TenantRow[], plans: Record<string, any>[] = []) {
  const events = new Map<string, any>();
  const matches = (row: TenantRow, where: Record<string, any>) =>
    Object.entries(where).every(([k, v]) => row[k] === v);
  return {
    events,
    tenants,
    tenant: {
      findUnique: jest.fn(async ({ where }) => tenants.find((t) => t.id === where.id) ?? null),
      findUniqueOrThrow: jest.fn(async ({ where }) => {
        const t = tenants.find((row) => row.id === where.id);
        if (!t) throw new Error('not found');
        return { ...t, plan: plans.find((p) => p.id === t.planId) ?? null };
      }),
      findFirst: jest.fn(async ({ where }) => tenants.find((t) => matches(t, where)) ?? null),
      update: jest.fn(async ({ where, data }) => {
        const t = tenants.find((row) => row.id === where.id)!;
        for (const [k, v] of Object.entries(data)) {
          if (k === 'plan') t.planId = (v as any).connect.id;
          else t[k] = v;
        }
        return t;
      }),
      updateMany: jest.fn(async ({ where, data }) => {
        const rows = tenants.filter((t) => matches(t, where));
        rows.forEach((t) => Object.assign(t, data));
        return { count: rows.length };
      }),
    },
    plan: {
      findUnique: jest.fn(async ({ where }) => plans.find((p) => p.slug === where.slug) ?? null),
      findFirst: jest.fn(async ({ where }) => plans.find((p) => p.stripePriceId === where.stripePriceId) ?? null),
    },
    stripeEvent: {
      findUnique: jest.fn(async ({ where }) => events.get(where.id) ?? null),
      createMany: jest.fn(async ({ data }) => {
        data.forEach((e: any) => events.set(e.id, e));
        return { count: data.length };
      }),
    },
  };
}

function baseTenant(overrides: TenantRow = {}): TenantRow {
  return {
    id: 'tenant-1',
    slug: 'acme',
    tradeName: 'Acme',
    legalName: 'Acme LTDA',
    email: 'financeiro@acme.test',
    phone: null,
    status: TenantStatus.trial,
    billingMode: 'stripe',
    isPlatform: false,
    trialEndsAt: new Date(Date.now() + 10 * 24 * 3600 * 1000),
    activatedAt: null,
    planId: 'plan-start',
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    stripeSubscriptionStatus: null,
    ...overrides,
  };
}

const plans = [
  { id: 'plan-start', slug: 'plano-start', isActive: true, stripePriceId: 'price_start' },
  { id: 'plan-pro', slug: 'plano-pro', isActive: true, stripePriceId: 'price_pro' },
  { id: 'plan-free', slug: 'plano-free', isActive: true, stripePriceId: null },
];

function subscription(overrides: Record<string, any> = {}) {
  return {
    id: 'sub_1',
    object: 'subscription',
    customer: 'cus_1',
    status: 'active',
    cancel_at_period_end: false,
    trial_end: null,
    ended_at: null,
    canceled_at: null,
    metadata: { tenantId: 'tenant-1' },
    items: { data: [{ current_period_end: 1_800_000_000, price: { id: 'price_pro' } }] },
    ...overrides,
  };
}

function setup(tenants: TenantRow[]) {
  const config = new ConfigService({
    STRIPE_SECRET_KEY: 'sk_test_fake',
    STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    APP_BASE_URL: 'https://opiina.test',
  });
  const stripeService = new StripeService(config);
  const stripe = stripeService.stripe;
  const prisma = makePrisma(tenants, plans);
  const audit = { log: jest.fn(async () => undefined) };
  const service = new BillingService(prisma as any, stripeService, audit as any, config);

  let currentSub = subscription();
  jest.spyOn(stripe.subscriptions, 'retrieve').mockImplementation((async () => currentSub) as any);

  const send = (event: Record<string, any>) => {
    const payload = JSON.stringify({ object: 'event', api_version: '2026-09-30', ...event });
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
    return service.handleWebhook(Buffer.from(payload), header);
  };

  return {
    service,
    stripe,
    prisma,
    audit,
    send,
    setSubscription: (s: Record<string, any>) => (currentSub = subscription(s)),
  };
}

describe('BillingService webhook', () => {
  it('rejects requests with an invalid signature', async () => {
    const { service } = setup([baseTenant()]);
    const payload = Buffer.from(JSON.stringify({ id: 'evt_x', type: 'invoice.paid' }));
    await expect(service.handleWebhook(payload, 't=1,v1=deadbeef')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.handleWebhook(payload, undefined)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('activates the tenant after checkout and links customer, subscription and plan', async () => {
    const tenants = [baseTenant()];
    const { send } = setup(tenants);

    const result = await send({
      id: 'evt_checkout',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_1',
          object: 'checkout.session',
          mode: 'subscription',
          customer: 'cus_1',
          subscription: 'sub_1',
          client_reference_id: 'tenant-1',
          metadata: { tenantId: 'tenant-1' },
        },
      },
    });

    expect(result).toEqual({ received: true });
    expect(tenants[0]).toMatchObject({
      status: TenantStatus.active,
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
      stripeSubscriptionStatus: 'active',
      planId: 'plan-pro',
    });
    expect(tenants[0].activatedAt).toBeInstanceOf(Date);
  });

  it('is idempotent for repeated deliveries of the same event', async () => {
    const tenants = [baseTenant({ stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_1' })];
    const { send, stripe } = setup(tenants);
    const event = {
      id: 'evt_dup',
      type: 'customer.subscription.updated',
      data: { object: subscription() },
    };

    expect(await send(event)).toEqual({ received: true });
    expect(await send(event)).toEqual({ received: true, duplicate: true });
    expect(stripe.subscriptions.retrieve).toHaveBeenCalledTimes(1);
  });

  it('marks the tenant delinquent on payment failure, then cancelled when the subscription ends', async () => {
    const tenants = [
      baseTenant({
        status: TenantStatus.active,
        activatedAt: new Date('2026-01-01'),
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_1',
        stripeSubscriptionStatus: 'active',
      }),
    ];
    const { send, setSubscription, audit } = setup(tenants);

    setSubscription({ status: 'past_due' });
    await send({
      id: 'evt_fail',
      type: 'invoice.payment_failed',
      data: {
        object: {
          id: 'in_1',
          object: 'invoice',
          amount_due: 19900,
          attempt_count: 1,
          parent: { type: 'subscription_details', subscription_details: { subscription: 'sub_1' } },
        },
      },
    });
    expect(tenants[0].status).toBe(TenantStatus.delinquent);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'billing.payment_failed' }));

    setSubscription({ status: 'canceled', ended_at: 1_801_000_000 });
    await send({ id: 'evt_del', type: 'customer.subscription.deleted', data: { object: subscription({ status: 'canceled' }) } });
    expect(tenants[0].status).toBe(TenantStatus.cancelled);
    expect(tenants[0].cancelledAt).toEqual(new Date(1_801_000_000 * 1000));
  });

  it('finds the tenant by Stripe customer when metadata is missing', async () => {
    const tenants = [baseTenant({ stripeCustomerId: 'cus_1' })];
    const { send, setSubscription } = setup(tenants);
    setSubscription({ metadata: {} });
    await send({ id: 'evt_c', type: 'customer.subscription.created', data: { object: subscription({ metadata: {} }) } });
    expect(tenants[0].status).toBe(TenantStatus.active);
  });

  it('never changes manual (DevMais) tenants', async () => {
    const tenants = [baseTenant({ billingMode: 'manual', status: TenantStatus.active })];
    const { send, setSubscription } = setup(tenants);
    setSubscription({ status: 'canceled' });
    await send({ id: 'evt_m', type: 'customer.subscription.deleted', data: { object: subscription() } });
    expect(tenants[0].status).toBe(TenantStatus.active);
  });

  it('ignores an old subscription ending while a newer one is live', async () => {
    const tenants = [
      baseTenant({
        status: TenantStatus.active,
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_new',
        stripeSubscriptionStatus: 'active',
      }),
    ];
    const { send, setSubscription } = setup(tenants);
    setSubscription({ id: 'sub_old', status: 'canceled' });
    await send({ id: 'evt_old', type: 'customer.subscription.deleted', data: { object: subscription({ id: 'sub_old' }) } });
    expect(tenants[0]).toMatchObject({ status: TenantStatus.active, stripeSubscriptionId: 'sub_new' });
  });

  it('acknowledges unrelated events without touching tenants', async () => {
    const { send, stripe } = setup([baseTenant()]);
    expect(await send({ id: 'evt_other', type: 'product.created', data: { object: { id: 'prod_1' } } })).toEqual({
      received: true,
      ignored: true,
    });
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
  });
});

describe('BillingService checkout', () => {
  const user = { userId: 'user-1', tenantId: 'tenant-1' } as any;

  it('creates the customer once and a subscription checkout preserving the remaining trial', async () => {
    const tenants = [baseTenant()];
    const { service, stripe } = setup(tenants);
    const customers = jest.spyOn(stripe.customers, 'create').mockResolvedValue({ id: 'cus_new' } as any);
    const sessions = jest
      .spyOn(stripe.checkout.sessions, 'create')
      .mockResolvedValue({ id: 'cs_1', url: 'https://checkout.stripe.test/cs_1' } as any);

    const result = await service.createCheckoutSession(user, 'plano-pro', {
      headers: { origin: 'https://acme.opiina.test' },
    } as any);

    expect(result).toEqual({ url: 'https://checkout.stripe.test/cs_1' });
    expect(customers).toHaveBeenCalledTimes(1);
    expect(tenants[0].stripeCustomerId).toBe('cus_new');
    const params = sessions.mock.calls[0][0]!;
    expect(params).toMatchObject({
      mode: 'subscription',
      customer: 'cus_new',
      client_reference_id: 'tenant-1',
      line_items: [{ price: 'price_pro', quantity: 1 }],
    });
    expect(params.subscription_data?.trial_end).toBe(Math.floor(tenants[0].trialEndsAt.getTime() / 1000));
    expect(params.success_url).toBe(
      'https://acme.opiina.test/app/company?billing=success&session_id={CHECKOUT_SESSION_ID}',
    );
  });

  it('sends the onboarding checkout back to the tenant login, even when signing up on the root domain', async () => {
    const { service, stripe } = setup([baseTenant()]);
    jest.spyOn(stripe.customers, 'create').mockResolvedValue({ id: 'cus_new' } as any);
    const sessions = jest
      .spyOn(stripe.checkout.sessions, 'create')
      .mockResolvedValue({ id: 'cs_1', url: 'https://checkout.stripe.test/cs_1' } as any);

    const result = await service.createOnboardingCheckoutSession('tenant-1', 'user-1', 'plano-pro', {
      headers: { origin: 'https://opiina.test' },
    } as any);

    expect(result).toEqual({ url: 'https://checkout.stripe.test/cs_1' });
    expect(sessions.mock.calls[0][0]).toMatchObject({
      success_url: 'https://acme.opiina.test/login?billing=success&plan=plano-pro&session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://acme.opiina.test/login?billing=cancelled',
    });
  });

  it('falls back to the tenant subdomain of APP_BASE_URL for foreign origins', () => {
    const { service } = setup([baseTenant()]);
    expect(service.tenantAppUrl('acme', { headers: { origin: 'https://evil.example' } } as any)).toBe(
      'https://acme.opiina.test',
    );
  });

  it('refuses manual tenants, tenants with a live subscription and plans without a Stripe price', async () => {
    const { service: manual } = setup([baseTenant({ billingMode: 'manual' })]);
    await expect(manual.createCheckoutSession(user, 'plano-pro')).rejects.toBeInstanceOf(ConflictException);

    const { service: subscribed } = setup([
      baseTenant({ stripeSubscriptionId: 'sub_1', stripeSubscriptionStatus: 'active' }),
    ]);
    await expect(subscribed.createCheckoutSession(user, 'plano-pro')).rejects.toThrow('subscription_exists');

    const { service: free } = setup([baseTenant()]);
    await expect(free.createCheckoutSession(user, 'plano-free')).rejects.toThrow('plan_not_billable');
  });
});
