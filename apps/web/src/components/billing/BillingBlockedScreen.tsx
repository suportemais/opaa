import type { TenantBilling } from '../../lib/billing-access';
import { useBillingRedirect } from '../../lib/billing';
import { Button } from '../ui/Button';

const TITLES: Record<string, { title: string; text: string }> = {
  trial_expired: {
    title: 'Sua assinatura ainda não está ativa',
    text: 'Assine um plano para acessar pesquisas, feedbacks e relatórios. Seus dados estão guardados.',
  },
  subscription_cancelled: {
    title: 'Sua assinatura foi encerrada',
    text: 'Assine novamente para voltar a usar o painel. Seus dados estão guardados.',
  },
  subscription_suspended: {
    title: 'Acesso suspenso por falta de pagamento',
    text: 'Regularize o pagamento para liberar o painel novamente.',
  },
};

export function BillingBlockedScreen(props: { billing: TenantBilling; canManage: boolean }) {
  const { billing, canManage } = props;
  const redirect = useBillingRedirect();
  const copy = TITLES[billing.blockReason ?? ''] ?? TITLES.trial_expired;
  // Suspensa (unpaid) ainda tem assinatura viva na Stripe: paga pelo portal.
  const payInPortal = billing.blockReason === 'subscription_suspended' && Boolean(billing.subscriptionStatus);

  return (
    <div data-testid="billing-blocked" className="mx-auto grid max-w-xl gap-4 rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
      <div className="text-xl font-semibold text-slate-900">{copy.title}</div>
      <p className="text-sm text-slate-600">{copy.text}</p>
      {billing.plan && (
        <p className="text-sm text-slate-700">
          Plano escolhido: <strong>{billing.plan.name}</strong>
        </p>
      )}
      {canManage ? (
        <div className="flex flex-col items-center gap-2">
          <Button
            onClick={() => (payInPortal ? redirect.openPortal() : redirect.startCheckout())}
            disabled={redirect.pending}
          >
            {payInPortal ? 'Regularizar pagamento' : 'Assinar agora'}
          </Button>
          {redirect.error && <div className="text-sm text-rose-700">{redirect.error}</div>}
        </div>
      ) : (
        <p className="text-sm text-slate-600">Peça a um administrador da sua empresa para regularizar a assinatura.</p>
      )}
    </div>
  );
}
