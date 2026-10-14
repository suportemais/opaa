export type TenantBilling = {
  billingMode?: string | null;
  status?: string | null;
  requiresStripeCheckout?: boolean;
  /** false quando a API não tem chave do Stripe: não oferece "Assinar". */
  stripeEnabled?: boolean;
  plan?: { id: string; name: string; slug: string } | null;
  trialEndsAt?: string | null;
  subscriptionStatus?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  accessBlocked?: boolean;
  blockReason?: 'trial_expired' | 'subscription_cancelled' | 'subscription_suspended' | null;
};

/** Dias inteiros restantes até a data (0 se já passou). */
export function daysUntil(iso?: string | null, now: Date = new Date()): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - now.getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

/** Manual (DevMais) customers must never see Stripe / "assine" prompts. */
export function shouldShowStripePrompts(billing?: TenantBilling | null): boolean {
  if (!billing) return false;
  if (typeof billing.requiresStripeCheckout === 'boolean') return billing.requiresStripeCheckout;
  if ((billing.billingMode ?? 'stripe') === 'manual') return false;
  return true;
}

export function subscriptionSourceLabel(billingMode?: string | null): string {
  return (billingMode ?? 'stripe') === 'manual' ? 'Manual · DevMais' : 'Stripe';
}

export function isPlatformOperator(user?: { permissionCodes?: string[]; roleCodes?: string[] } | null) {
  if (!user) return false;
  const roles = user.roleCodes ?? [];
  const permissions = user.permissionCodes ?? [];
  return (
    roles.includes('platform_admin') ||
    permissions.includes('platform:tenant:manage') ||
    permissions.includes('platform:tenant:read')
  );
}

export function canManagePlatform(user?: { permissionCodes?: string[] } | null) {
  return Boolean(user?.permissionCodes?.includes('platform:tenant:manage'));
}
