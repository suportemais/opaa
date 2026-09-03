export type BillingModeValue = 'stripe' | 'manual';
export type ManualAccessReasonValue = 'manual' | 'cortesia' | 'trial_grant';

export type TenantBillingSnapshot = {
  billingMode?: string | null;
  status?: string | null;
};

/**
 * Self-serve tenants may see Stripe checkout later.
 * Manual (DevMais) customers must never be asked for a card.
 */
export function shouldShowStripePrompts(
  input: TenantBillingSnapshot | null | undefined,
): boolean {
  if (!input) return false;
  const mode = input.billingMode ?? 'stripe';
  if (mode === 'manual') return false;
  return true;
}

export function subscriptionSourceLabel(billingMode?: string | null): string {
  return (billingMode ?? 'stripe') === 'manual' ? 'Manual · DevMais' : 'Stripe';
}

export function isManualAccessReason(
  value: unknown,
): value is ManualAccessReasonValue {
  return value === 'manual' || value === 'cortesia' || value === 'trial_grant';
}
