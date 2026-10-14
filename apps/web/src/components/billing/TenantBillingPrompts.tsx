import { daysUntil, shouldShowStripePrompts, type TenantBilling } from '../../lib/billing-access';
import { useBillingRedirect, type BillingReturnNotice } from '../../lib/billing';
import { Button } from '../ui/Button';

/**
 * Avisos de cobrança self-serve (Stripe) no topo do painel. Clientes manuais
 * (DevMais) nunca veem "assine" nem pedido de cartão.
 */
export function TenantBillingPrompts(props: {
  billing?: TenantBilling | null;
  canManage?: boolean;
  notice?: BillingReturnNotice;
  onDismissNotice?: () => void;
}) {
  const { billing, canManage, notice } = props;
  const redirect = useBillingRedirect();

  const noticeBox = notice ? (
    <div
      data-testid="billing-return-notice"
      className={[
        'flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm',
        notice.kind === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
          : 'border-slate-200 bg-slate-50 text-slate-800',
      ].join(' ')}
    >
      <span>{notice.text}</span>
      {notice.kind !== 'pending' && props.onDismissNotice && (
        <button type="button" className="text-xs underline" onClick={props.onDismissNotice}>
          Fechar
        </button>
      )}
    </div>
  ) : null;

  if (!shouldShowStripePrompts(billing) || billing?.accessBlocked) return noticeBox;

  // Sem chave do Stripe na API: mantém o aviso informativo, sem botão que daria erro
  if (billing?.stripeEnabled === false) {
    if (billing.status !== 'trial') return noticeBox;
    return (
      <div className="grid gap-3">
        {noticeBox}
        <Banner tone="info" testId="stripe-trial-hint">
          <span>
            Você está no período de trial. A cobrança self-serve (Stripe) será liberada em breve — nenhum cartão é
            exigido agora.
          </span>
        </Banner>
      </div>
    );
  }

  const hasSubscription = Boolean(billing?.subscriptionStatus);
  let body: React.ReactNode = null;

  if (billing?.status === 'trial' && !hasSubscription) {
    const days = daysUntil(billing.trialEndsAt);
    body = (
      <Banner tone="info" testId="stripe-trial-hint">
        <span>
          Você está no período de teste
          {days !== null && <> — {days === 0 ? 'termina hoje' : `faltam ${days} ${days === 1 ? 'dia' : 'dias'}`}</>}.
          {' '}Assine para continuar usando sem interrupção; a cobrança só começa quando o teste acabar.
        </span>
        {canManage && (
          <Button onClick={() => redirect.startCheckout()} disabled={redirect.pending}>
            Assinar agora
          </Button>
        )}
      </Banner>
    );
  } else if (billing?.status === 'delinquent') {
    body = (
      <Banner tone="warn" testId="stripe-delinquent">
        <span>Não conseguimos cobrar a última fatura. Atualize a forma de pagamento para evitar o bloqueio do painel.</span>
        {canManage && (
          <Button onClick={() => redirect.openPortal()} disabled={redirect.pending}>
            Atualizar pagamento
          </Button>
        )}
      </Banner>
    );
  } else if (billing?.cancelAtPeriodEnd && billing.currentPeriodEnd) {
    body = (
      <Banner tone="info" testId="stripe-cancel-scheduled">
        <span>
          Sua assinatura foi cancelada e fica ativa até {new Date(billing.currentPeriodEnd).toLocaleDateString('pt-BR')}.
        </span>
        {canManage && (
          <Button variant="secondary" onClick={() => redirect.openPortal()} disabled={redirect.pending}>
            Reativar
          </Button>
        )}
      </Banner>
    );
  }

  if (!body && !noticeBox) return null;
  return (
    <div className="grid gap-3">
      {noticeBox}
      {body}
      {redirect.error && <div className="text-sm text-rose-700">{redirect.error}</div>}
    </div>
  );
}

function Banner(props: { tone: 'info' | 'warn'; testId: string; children: React.ReactNode }) {
  const tones = {
    info: 'border-sky-200 bg-sky-50 text-sky-900',
    warn: 'border-amber-300 bg-amber-50 text-amber-900',
  };
  return (
    <div
      data-testid={props.testId}
      className={`flex flex-col gap-3 rounded-lg border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between ${tones[props.tone]}`}
    >
      {props.children}
    </div>
  );
}
