import {
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
