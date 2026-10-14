import type Stripe from 'stripe';
import { TenantStatus } from '@prisma/client';

export type TenantSubscriptionPatch = {
  status?: TenantStatus;
  stripeSubscriptionId: string;
  stripeSubscriptionStatus: string;
  stripeCurrentPeriodEnd: Date | null;
  stripeCancelAtPeriodEnd: boolean;
  trialEndsAt?: Date | null;
  activatedAt?: Date;
  suspendedAt?: Date | null;
  cancelledAt?: Date | null;
};

type CurrentTenant = {
  status: TenantStatus;
  activatedAt: Date | null;
};

function fromUnix(value: number | null | undefined): Date | null {
  return typeof value === 'number' && value > 0 ? new Date(value * 1000) : null;
}

/** Na API atual da Stripe o fim do período fica nos itens da assinatura. */
export function subscriptionPeriodEnd(sub: Stripe.Subscription): Date | null {
  const ends = (sub.items?.data ?? [])
    .map((item) => item.current_period_end)
    .filter((v): v is number => typeof v === 'number');
  if (ends.length === 0) return null;
  return fromUnix(Math.max(...ends));
}

export function subscriptionPriceId(sub: Stripe.Subscription): string | null {
  return sub.items?.data?.[0]?.price?.id ?? null;
}

/**
 * Traduz o estado da assinatura na Stripe para o estado do tenant.
 * - trialing  → trial (trialEndsAt = trial_end)
 * - active    → active
 * - past_due  → delinquent (mantém acesso enquanto a Stripe tenta cobrar)
 * - unpaid / paused → suspended
 * - canceled / incomplete_expired → cancelled
 * - incomplete → não altera o status (primeiro pagamento ainda pendente)
 */
export function tenantPatchFromSubscription(
  sub: Stripe.Subscription,
  current: CurrentTenant,
  now: Date = new Date(),
): TenantSubscriptionPatch {
  const patch: TenantSubscriptionPatch = {
    stripeSubscriptionId: sub.id,
    stripeSubscriptionStatus: sub.status,
    stripeCurrentPeriodEnd: subscriptionPeriodEnd(sub),
    stripeCancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
  };

  switch (sub.status) {
    case 'trialing':
      patch.status = TenantStatus.trial;
      patch.trialEndsAt = fromUnix(sub.trial_end);
      patch.suspendedAt = null;
      patch.cancelledAt = null;
      break;
    case 'active':
      patch.status = TenantStatus.active;
      patch.activatedAt = current.activatedAt ?? now;
      patch.suspendedAt = null;
      patch.cancelledAt = null;
      break;
    case 'past_due':
      patch.status = TenantStatus.delinquent;
      break;
    case 'unpaid':
    case 'paused':
      patch.status = TenantStatus.suspended;
      if (current.status !== TenantStatus.suspended) patch.suspendedAt = now;
      break;
    case 'canceled':
    case 'incomplete_expired':
      patch.status = TenantStatus.cancelled;
      patch.cancelledAt = fromUnix(sub.ended_at) ?? fromUnix(sub.canceled_at) ?? now;
      break;
    default:
      // 'incomplete' e status futuros: só registra o status bruto.
      break;
  }

  return patch;
}
