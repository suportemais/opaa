import { shouldShowStripePrompts, type TenantBilling } from '../../lib/billing-access';

/**
 * Tenant-app Stripe prompts. Manual + DevMais customers must never see "assine"
 * or a missing-card block. Stripe checkout itself is out of this PR.
 */
export function TenantBillingPrompts(props: { billing?: TenantBilling | null }) {
  if (!shouldShowStripePrompts(props.billing)) return null;

  if (props.billing?.status === 'trial') {
    return (
      <div
        data-testid="stripe-trial-hint"
        className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900"
      >
        Você está no período de trial. A cobrança self-serve (Stripe) será liberada em breve — nenhum cartão é
        exigido agora.
      </div>
    );
  }

  return null;
}
