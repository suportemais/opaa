import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { AdminEmptyState } from '../../components/admin/AdminEmptyState';
import { formatDate } from '../../lib/admin-format';

type Overview = {
  period: { from: string; to: string };
  kpis: {
    activeAccounts: number;
    trialAccounts: number;
    pastDueAccounts: number;
    pastDueAvailable: boolean;
    npsResponses: number;
  };
};

function KpiCard(props: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{props.label}</div>
      <div className="mt-2 bg-gradient-to-r from-cyan-600 to-violet-600 bg-clip-text text-3xl font-semibold text-transparent">
        {props.value}
      </div>
      {props.hint && <div className="mt-2 text-xs text-slate-500">{props.hint}</div>}
    </div>
  );
}

export function AdminOverviewPage() {
  const overview = useQuery({
    queryKey: ['adminOverview'],
    queryFn: () => apiFetch<Overview>('/admin/overview'),
  });

  if (overview.isError) {
    return (
      <AdminEmptyState
        title="Não foi possível carregar a visão geral"
        description="Tente novamente. Nenhum dado bruto é exibido quando a API falha."
        onRetry={() => void overview.refetch()}
      />
    );
  }

  const kpis = overview.data?.kpis;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Visão geral</h1>
        <p className="text-sm text-slate-600">
          Contas da plataforma OPIINA
          {overview.data
            ? ` · NPS de ${formatDate(overview.data.period.from)} a ${formatDate(overview.data.period.to)}`
            : ''}
        </p>
      </div>

      {overview.isLoading && !kpis ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200/70" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Contas ativas" value={kpis?.activeAccounts ?? 0} />
          <KpiCard label="Em trial" value={kpis?.trialAccounts ?? 0} />
          <KpiCard
            label="Inadimplentes"
            value={kpis?.pastDueAccounts ?? 0}
            hint="Past due via Stripe ainda não está ligado — valor 0 até webhooks."
          />
          <KpiCard label="Respostas NPS no período" value={kpis?.npsResponses ?? 0} />
        </div>
      )}
    </div>
  );
}
