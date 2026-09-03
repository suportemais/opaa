import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { AdminEmptyState } from '../../components/admin/AdminEmptyState';
import { accountStatusClass, accountStatusLabel, formatDate } from '../../lib/admin-format';

type SubscriptionRow = {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  plan: { id: string; name: string; slug: string } | null;
  status: string;
  billingMode: string;
  source: 'stripe' | 'manual';
  sourceLabel: string;
  validUntil: string | null;
  trialEndsAt: string | null;
  accessValidUntil: string | null;
  stripeSubscriptionId: string | null;
  createdAt: string;
};

export function AdminSubscriptionsPage() {
  const rows = useQuery({
    queryKey: ['adminSubscriptions'],
    queryFn: () => apiFetch<SubscriptionRow[]>('/admin/subscriptions'),
  });

  if (rows.isError) {
    return (
      <AdminEmptyState
        title="Não foi possível carregar as assinaturas"
        description="A listagem é somente leitura. Tente novamente."
        onRetry={() => void rows.refetch()}
      />
    );
  }

  const data = rows.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Assinaturas</h1>
        <p className="text-sm text-slate-600">Somente leitura. Stripe vs Manual · DevMais. Sem webhooks neste PR.</p>
      </div>

      {rows.isLoading ? (
        <div className="h-48 animate-pulse rounded-2xl bg-slate-200/70" />
      ) : data.length === 0 ? (
        <AdminEmptyState title="Nenhuma assinatura" description="As contas de clientes aparecerão aqui." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Conta</th>
                <th className="px-4 py-3 font-medium">Plano</th>
                <th className="px-4 py-3 font-medium">Origem</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Validade</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <Link to={`/admin/contas/${row.tenantId}`} className="font-medium text-cyan-700 hover:underline">
                      {row.tenantName}
                    </Link>
                    <div className="text-xs text-slate-500">{row.tenantSlug}</div>
                  </td>
                  <td className="px-4 py-3">{row.plan?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        row.source === 'manual'
                          ? 'inline-flex rounded-full bg-violet-50 px-2 py-0.5 text-xs text-violet-800 ring-1 ring-violet-200'
                          : 'inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 ring-1 ring-slate-200'
                      }
                    >
                      {row.sourceLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ring-1 ${accountStatusClass(row.status)}`}>
                      {accountStatusLabel(row.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {row.validUntil ? formatDate(row.validUntil) : row.source === 'manual' ? 'Sem validade' : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
