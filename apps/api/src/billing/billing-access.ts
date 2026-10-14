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

export type TenantAccessSnapshot = {
  billingMode?: string | null;
  status?: string | null;
  trialEndsAt?: Date | null;
  isPlatform?: boolean | null;
};

export type BillingBlockReason =
  | 'trial_expired'
  | 'subscription_cancelled'
  | 'subscription_suspended';

/**
 * Motivo pelo qual um tenant self-serve (Stripe) perdeu acesso ao painel, ou
 * null se o acesso está liberado. Contas manuais (DevMais) e a conta da
 * plataforma nunca são bloqueadas aqui — esse controle é feito pelo suporte.
 * `delinquent` (past_due) continua com acesso enquanto a Stripe tenta cobrar.
 */
export function billingBlockReason(
  tenant: TenantAccessSnapshot | null | undefined,
  now: Date = new Date(),
): BillingBlockReason | null {
  if (!tenant || tenant.isPlatform) return null;
  if ((tenant.billingMode ?? 'stripe') === 'manual') return null;

  switch (tenant.status) {
    case 'trial':
      if (tenant.trialEndsAt && tenant.trialEndsAt.getTime() <= now.getTime())
        return 'trial_expired';
      return null;
    case 'cancelled':
      return 'subscription_cancelled';
    case 'suspended':
      return 'subscription_suspended';
    default:
      return null;
  }
}

export function isBillingEnforcementEnabled(
  value: string | undefined = process.env.BILLING_ENFORCEMENT,
): boolean {
  return ['1', 'true', 'on', 'yes'].includes((value ?? '').trim().toLowerCase());
}

/** Stripe só é oferecido (botão "Assinar") quando a chave secreta está configurada. */
export function isStripeConfigured(value: string | undefined = process.env.STRIPE_SECRET_KEY): boolean {
  return Boolean((value ?? '').trim());
}
