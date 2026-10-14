import {
  billingBlockReason,
  isBillingEnforcementEnabled,
  isManualAccessReason,
  shouldShowStripePrompts,
  subscriptionSourceLabel,
} from './billing-access';

describe('billing-access', () => {
  it('never shows Stripe prompts for manual billing, even when trial/suspended', () => {
    expect(
      shouldShowStripePrompts({ billingMode: 'manual', status: 'active' }),
    ).toBe(false);
    expect(
      shouldShowStripePrompts({ billingMode: 'manual', status: 'trial' }),
    ).toBe(false);
    expect(
      shouldShowStripePrompts({ billingMode: 'manual', status: 'suspended' }),
    ).toBe(false);
  });

  it('allows Stripe prompts for self-serve (default stripe) tenants', () => {
    expect(
      shouldShowStripePrompts({ billingMode: 'stripe', status: 'trial' }),
    ).toBe(true);
    expect(
      shouldShowStripePrompts({ billingMode: 'stripe', status: 'active' }),
    ).toBe(true);
    expect(shouldShowStripePrompts({ status: 'trial' })).toBe(true);
  });

  it('hides prompts when billing snapshot is missing', () => {
    expect(shouldShowStripePrompts(null)).toBe(false);
    expect(shouldShowStripePrompts(undefined)).toBe(false);
  });

  it('labels manual rows as Manual · DevMais', () => {
    expect(subscriptionSourceLabel('manual')).toBe('Manual · DevMais');
    expect(subscriptionSourceLabel('stripe')).toBe('Stripe');
    expect(subscriptionSourceLabel(null)).toBe('Stripe');
  });

  it('accepts only the three Liberar acesso reasons', () => {
    expect(isManualAccessReason('manual')).toBe(true);
    expect(isManualAccessReason('cortesia')).toBe(true);
    expect(isManualAccessReason('trial_grant')).toBe(true);
    expect(isManualAccessReason('stripe')).toBe(false);
  });
});

describe('billingBlockReason', () => {
  const now = new Date('2026-10-14T12:00:00Z');
  const past = new Date('2026-10-01T00:00:00Z');
  const future = new Date('2026-10-30T00:00:00Z');

  it('blocks self-serve tenants whose trial expired', () => {
    expect(billingBlockReason({ billingMode: 'stripe', status: 'trial', trialEndsAt: past }, now)).toBe('trial_expired');
    expect(billingBlockReason({ billingMode: 'stripe', status: 'trial', trialEndsAt: future }, now)).toBeNull();
  });

  it('blocks cancelled and suspended subscriptions but keeps delinquent (past_due) access', () => {
    expect(billingBlockReason({ billingMode: 'stripe', status: 'cancelled' }, now)).toBe('subscription_cancelled');
    expect(billingBlockReason({ billingMode: 'stripe', status: 'suspended' }, now)).toBe('subscription_suspended');
    expect(billingBlockReason({ billingMode: 'stripe', status: 'delinquent' }, now)).toBeNull();
    expect(billingBlockReason({ billingMode: 'stripe', status: 'active' }, now)).toBeNull();
  });

  it('never blocks manual (DevMais) or platform tenants', () => {
    expect(billingBlockReason({ billingMode: 'manual', status: 'cancelled' }, now)).toBeNull();
    expect(billingBlockReason({ billingMode: 'manual', status: 'trial', trialEndsAt: past }, now)).toBeNull();
    expect(billingBlockReason({ billingMode: 'stripe', status: 'cancelled', isPlatform: true }, now)).toBeNull();
  });

  it('reads the enforcement flag', () => {
    expect(isBillingEnforcementEnabled('true')).toBe(true);
    expect(isBillingEnforcementEnabled('on')).toBe(true);
    expect(isBillingEnforcementEnabled('false')).toBe(false);
    expect(isBillingEnforcementEnabled(undefined)).toBe(false);
  });
});
