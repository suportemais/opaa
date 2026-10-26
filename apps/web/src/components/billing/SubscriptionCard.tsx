import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { daysUntil } from '../../lib/billing-access';
import { useBillingRedirect } from '../../lib/billing';

type BillingSummary = {
  stripeEnabled: boolean;
  status: string;
  billingMode: 'stripe' | 'manual';
  trialEndsAt: string | null;
  plan: { id: string; name: string; slug: string; billable: boolean } | null;
  hasStripeCustomer: boolean;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  hasLiveSubscription: boolean;
};

const STATUS_LABELS: Record<string, string> = {
  trial: 'Período de teste',
  active: 'Ativa',
  delinquent: 'Pagamento pendente',
  suspended: 'Suspensa',
  cancelled: 'Cancelada',
};

function fmt(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';
}

export function SubscriptionCard() {
  const me = useQuery({
    queryKey: ['authMe'],
    queryFn: () => apiFetch<{ permissionCodes: string[] }>('/auth/me'),
  });
  const canManage = Boolean(me.data?.permissionCodes?.includes('tenant:settings:manage'));
  const summary = useQuery({
    queryKey: ['tenantMe', 'billing'],
    queryFn: () => apiFetch<BillingSummary>('/billing/me'),
  });
  const redirect = useBillingRedirect();
  const data = summary.data;
  if (!data) return null;

  if (data.billingMode === 'manual') {
    return (
      <section className="cartao cfg__cartao" aria-labelledby="t-assinatura">
        <div className="cfg__topo">
          <div>
            <h2 className="cartao__titulo" id="t-assinatura">
              Assinatura
            </h2>
            <p className="cartao__sub">Cobrança gerenciada pela equipe Dev+</p>
          </div>
        </div>
        <p>
          Plano: <strong>{data.plan?.name ?? '—'}</strong>. Para mudanças de plano ou cobrança, fale com o seu contato na Dev+.
        </p>
      </section>
    );
  }

  const trialDays = data.status === 'trial' ? daysUntil(data.trialEndsAt) : null;
  // Conta criada sem teste grátis: fica em "trial" até a Stripe ativar a assinatura.
  const emTeste = Boolean(trialDays);

  return (
    <section className="cartao cfg__cartao" aria-labelledby="t-assinatura">
      <div className="cfg__topo">
        <div>
          <h2 className="cartao__titulo" id="t-assinatura">
            Assinatura
          </h2>
          <p className="cartao__sub">Plano, cobrança e forma de pagamento</p>
        </div>
        {canManage && data.stripeEnabled && (
          <div className="cfg__botoes">
            {!data.hasLiveSubscription && (
              <button
                className="btn btn--primario"
                type="button"
                onClick={() => redirect.startCheckout()}
                disabled={redirect.pending || !data.plan?.billable}
              >
                Assinar {data.plan?.name ?? ''}
              </button>
            )}
            {data.hasStripeCustomer && (
              <button className="btn btn--secundario" type="button" onClick={() => redirect.openPortal()} disabled={redirect.pending}>
                Gerenciar assinatura
              </button>
            )}
          </div>
        )}
      </div>
      <dl className="cfg-assinatura">
        <div>
          <dt>Plano</dt>
          <dd>{data.plan?.name ?? 'Nenhum'}</dd>
        </div>
        <div>
          <dt>Situação</dt>
          <dd>
            {data.status === 'trial' && !emTeste ? 'Aguardando assinatura' : (STATUS_LABELS[data.status] ?? data.status)}
            {data.cancelAtPeriodEnd && ' · cancelamento agendado'}
          </dd>
        </div>
        <div>
          <dt>{emTeste ? 'Teste até' : 'Próxima renovação'}</dt>
          <dd>
            {emTeste ? fmt(data.trialEndsAt) : fmt(data.currentPeriodEnd)}
            {emTeste && <span className="mudo"> ({trialDays} {trialDays === 1 ? 'dia' : 'dias'})</span>}
          </dd>
        </div>
      </dl>

      {canManage && data.stripeEnabled && data.plan && !data.plan.billable && !data.hasLiveSubscription && (
        <p className="campo__dica">Este plano ainda não está liberado para assinatura online.</p>
      )}
      {redirect.error && (
        <p className="campo__erro" role="alert">
          {redirect.error}
        </p>
      )}
    </section>
  );
}
