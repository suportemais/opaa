import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { AdminEmptyState } from '../../components/admin/AdminEmptyState';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { accountStatusClass, accountStatusLabel, formatDate, grantReasonLabel } from '../../lib/admin-format';
import type { AdminAccount } from './AdminAccountsPage';

type AdminPlan = { id: string; name: string; slug: string };

export function AdminAccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [planId, setPlanId] = useState('');
  const [trialDays, setTrialDays] = useState('14');
  const [grantPlanId, setGrantPlanId] = useState('');
  const [grantUntil, setGrantUntil] = useState('');
  const [grantNoExpiry, setGrantNoExpiry] = useState(true);
  const [grantReason, setGrantReason] = useState<'manual' | 'cortesia' | 'trial_grant'>('manual');
  const [actionError, setActionError] = useState<string | null>(null);

  const account = useQuery({
    queryKey: ['adminAccount', id],
    queryFn: () => apiFetch<AdminAccount>(`/admin/accounts/${id}`),
    enabled: Boolean(id),
  });

  const plans = useQuery({
    queryKey: ['adminPlans'],
    queryFn: () => apiFetch<AdminPlan[]>('/admin/plans'),
  });

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ['adminAccount', id] });
    await qc.invalidateQueries({ queryKey: ['adminAccounts'] });
    await qc.invalidateQueries({ queryKey: ['adminSubscriptions'] });
    await qc.invalidateQueries({ queryKey: ['adminOverview'] });
  };

  const runAction = useMutation({
    mutationFn: async (input: { path: string; json?: unknown }) => {
      setActionError(null);
      return apiFetch<AdminAccount>(input.path, { method: 'POST', json: input.json ?? {} });
    },
    onSuccess: async () => {
      await invalidate();
    },
    onError: () => {
      setActionError('Não foi possível concluir a ação. Tente novamente.');
    },
  });

  if (account.isError) {
    return (
      <AdminEmptyState
        title="Conta indisponível"
        description="Não foi possível carregar este tenant. Verifique o endereço ou tente de novo."
        onRetry={() => void account.refetch()}
      />
    );
  }

  if (account.isLoading || !account.data) {
    return <div className="h-64 animate-pulse rounded-2xl bg-slate-200/70" />;
  }

  const row = account.data;
  const planOptions = plans.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/admin/contas" className="text-sm text-cyan-700 hover:underline">
          ← Contas
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">{row.tradeName}</h1>
        <p className="text-sm text-slate-600">
          {row.legalName} · {row.slug}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="text-sm font-semibold text-slate-900">Resumo</div>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd className="mt-1">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ring-1 ${accountStatusClass(row.status)}`}>
                  {accountStatusLabel(row.status)}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Plano</dt>
              <dd className="mt-1 font-medium">{row.plan?.name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Cobrança</dt>
              <dd className="mt-1">{row.sourceLabel}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Unidades</dt>
              <dd className="mt-1">{row.unitsCount}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Responsável</dt>
              <dd className="mt-1">
                {row.owner?.name ?? '—'}
                {row.owner?.email ? <div className="text-xs text-slate-500">{row.owner.email}</div> : null}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">E-mail da conta</dt>
              <dd className="mt-1">{row.email}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Criada em</dt>
              <dd className="mt-1">{formatDate(row.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Trial até</dt>
              <dd className="mt-1">{formatDate(row.trialEndsAt)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Acesso válido até</dt>
              <dd className="mt-1">{row.accessValidUntil ? formatDate(row.accessValidUntil) : 'Sem validade'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Motivo do acesso</dt>
              <dd className="mt-1">{grantReasonLabel(row.manualAccessReason)}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">Ações</div>
          {actionError && <div className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{actionError}</div>}

          <div className="mt-4 space-y-4 text-sm">
            <div>
              <div className="mb-1 font-medium text-slate-700">Alterar plano</div>
              <select
                value={planId || row.plan?.id || ''}
                onChange={(e) => setPlanId(e.target.value)}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="">Selecione</option>
                {planOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <Button
                className="mt-2 w-full bg-cyan-600 hover:bg-cyan-700"
                disabled={runAction.isPending || !(planId || row.plan?.id)}
                onClick={() =>
                  runAction.mutate({
                    path: `/admin/accounts/${row.id}/change-plan`,
                    json: { planId: planId || row.plan?.id },
                  })
                }
              >
                Salvar plano
              </Button>
            </div>

            <div>
              <div className="mb-1 font-medium text-slate-700">Estender trial</div>
              <Input value={trialDays} onChange={(e) => setTrialDays(e.target.value)} />
              <Button
                variant="secondary"
                className="mt-2 w-full"
                disabled={runAction.isPending}
                onClick={() =>
                  runAction.mutate({
                    path: `/admin/accounts/${row.id}/extend-trial`,
                    json: { days: Number(trialDays) || 14 },
                  })
                }
              >
                Estender {trialDays || 14} dias
              </Button>
            </div>

            <div className="flex gap-2">
              {row.status === 'suspended' ? (
                <Button
                  className="flex-1 bg-cyan-600 hover:bg-cyan-700"
                  disabled={runAction.isPending}
                  onClick={() => runAction.mutate({ path: `/admin/accounts/${row.id}/reactivate` })}
                >
                  Reativar
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  className="flex-1"
                  disabled={runAction.isPending}
                  onClick={() => runAction.mutate({ path: `/admin/accounts/${row.id}/suspend` })}
                >
                  Suspender
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-sm font-semibold text-slate-900">Liberar acesso</div>
        <p className="mt-1 text-sm text-slate-600">
          Cliente que paga a Dev Mais direto. Define cobrança manual — a app do tenant não mostra Stripe nem “assine”.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">Plano</div>
            <select
              value={grantPlanId || row.plan?.id || ''}
              onChange={(e) => setGrantPlanId(e.target.value)}
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">Selecione</option>
              {planOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">Motivo</div>
            <select
              value={grantReason}
              onChange={(e) => setGrantReason(e.target.value as typeof grantReason)}
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="manual">Manual</option>
              <option value="cortesia">Cortesia</option>
              <option value="trial_grant">Trial concedido</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
            <input type="checkbox" checked={grantNoExpiry} onChange={(e) => setGrantNoExpiry(e.target.checked)} />
            Sem validade (acesso contínuo)
          </label>
          {!grantNoExpiry && (
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">Válido até</div>
              <Input type="date" value={grantUntil} onChange={(e) => setGrantUntil(e.target.value)} />
            </div>
          )}
        </div>
        <Button
          className="mt-4 bg-violet-600 hover:bg-violet-700"
          disabled={runAction.isPending || !(grantPlanId || row.plan?.id)}
          onClick={() =>
            runAction.mutate({
              path: `/admin/accounts/${row.id}/grant-access`,
              json: {
                planId: grantPlanId || row.plan?.id,
                accessValidUntil: grantNoExpiry ? null : grantUntil || null,
                reason: grantReason,
              },
            })
          }
        >
          Liberar acesso
        </Button>
      </div>
    </div>
  );
}
