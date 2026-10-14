import { TenantStatus } from '@prisma/client';
import type Stripe from 'stripe';
import { tenantPatchFromSubscription } from './stripe-subscription-sync';

function sub(partial: Partial<Stripe.Subscription>): Stripe.Subscription {
  return {
    id: 'sub_123',
    status: 'active',
    cancel_at_period_end: false,
    trial_end: null,
    ended_at: null,
    canceled_at: null,
    items: { data: [{ current_period_end: 1_800_000_000, price: { id: 'price_1' } }] },
    ...partial,
  } as unknown as Stripe.Subscription;
}

const now = new Date('2026-10-14T12:00:00Z');
const trialTenant = { status: TenantStatus.trial, activatedAt: null };

describe('tenantPatchFromSubscription', () => {
  it('activates the tenant and keeps the first activation date', () => {
    const patch = tenantPatchFromSubscription(sub({ status: 'active' }), trialTenant, now);
    expect(patch.status).toBe(TenantStatus.active);
    expect(patch.activatedAt).toEqual(now);
    expect(patch.stripeCurrentPeriodEnd).toEqual(new Date(1_800_000_000 * 1000));

    const earlier = new Date('2026-01-01T00:00:00Z');
    const again = tenantPatchFromSubscription(sub({ status: 'active' }), { status: TenantStatus.delinquent, activatedAt: earlier }, now);
    expect(again.activatedAt).toEqual(earlier);
  });

  it('maps trialing to trial with the Stripe trial end', () => {
    const patch = tenantPatchFromSubscription(sub({ status: 'trialing', trial_end: 1_790_000_000 }), trialTenant, now);
    expect(patch.status).toBe(TenantStatus.trial);
    expect(patch.trialEndsAt).toEqual(new Date(1_790_000_000 * 1000));
  });

  it('maps payment problems', () => {
    expect(tenantPatchFromSubscription(sub({ status: 'past_due' }), trialTenant, now).status).toBe(TenantStatus.delinquent);
    const unpaid = tenantPatchFromSubscription(sub({ status: 'unpaid' }), { status: TenantStatus.delinquent, activatedAt: now }, now);
    expect(unpaid.status).toBe(TenantStatus.suspended);
    expect(unpaid.suspendedAt).toEqual(now);
  });

  it('maps cancellation using the Stripe end date', () => {
    const patch = tenantPatchFromSubscription(sub({ status: 'canceled', ended_at: 1_795_000_000 }), trialTenant, now);
    expect(patch.status).toBe(TenantStatus.cancelled);
    expect(patch.cancelledAt).toEqual(new Date(1_795_000_000 * 1000));
  });

  it('does not change tenant status while the first payment is incomplete', () => {
    const patch = tenantPatchFromSubscription(sub({ status: 'incomplete' }), trialTenant, now);
    expect(patch.status).toBeUndefined();
    expect(patch.stripeSubscriptionStatus).toBe('incomplete');
  });

  it('records cancel_at_period_end', () => {
    expect(tenantPatchFromSubscription(sub({ cancel_at_period_end: true }), trialTenant, now).stripeCancelAtPeriodEnd).toBe(true);
  });
});
