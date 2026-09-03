export type TenantBilling = {
  billingMode?: string | null;
  status?: string | null;
  requiresStripeCheckout?: boolean;
};

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
