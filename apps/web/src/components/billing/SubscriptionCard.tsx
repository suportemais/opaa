import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { daysUntil } from '../../lib/billing-access';
import { useBillingRedirect } from '../../lib/billing';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

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
      <Card title="Assinatura" description="Cobrança gerenciada pela equipe Dev+">
        <div className="text-sm text-slate-700">
          Plano: <strong>{data.plan?.name ?? '—'}</strong>. Para mudanças de plano ou cobrança, fale com o seu contato na Dev+.
        </div>
      </Card>
    );
  }

  const trialDays = data.status === 'trial' ? daysUntil(data.trialEndsAt) : null;

  return (
    <Card title="Assinatura" description="Plano, cobrança e forma de pagamento">
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-slate-500">Plano</dt>
          <dd className="font-medium text-slate-900">{data.plan?.name ?? 'Nenhum'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Situação</dt>
          <dd className="font-medium text-slate-900">
            {STATUS_LABELS[data.status] ?? data.status}
            {data.cancelAtPeriodEnd && ' · cancelamento agendado'}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">{data.status === 'trial' ? 'Teste até' : 'Próxima renovação'}</dt>
          <dd className="font-medium text-slate-900">
            {data.status === 'trial' ? fmt(data.trialEndsAt) : fmt(data.currentPeriodEnd)}
            {trialDays !== null && <span className="text-slate-500"> ({trialDays} {trialDays === 1 ? 'dia' : 'dias'})</span>}
          </dd>
        </div>
      </dl>

      {canManage && data.stripeEnabled && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {!data.hasLiveSubscription && (
            <Button onClick={() => redirect.startCheckout()} disabled={redirect.pending || !data.plan?.billable}>
              Assinar {data.plan?.name ?? ''}
            </Button>
          )}
          {data.hasStripeCustomer && (
            <Button variant="secondary" onClick={() => redirect.openPortal()} disabled={redirect.pending}>
              Gerenciar assinatura
            </Button>
          )}
          {data.plan && !data.plan.billable && !data.hasLiveSubscription && (
            <span className="text-sm text-slate-500">Este plano ainda não está liberado para assinatura online.</span>
          )}
        </div>
      )}
      {redirect.error && <div className="mt-2 text-sm text-rose-700">{redirect.error}</div>}
    </Card>
  );
}
