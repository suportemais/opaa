import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { AdminEmptyState } from '../../components/admin/AdminEmptyState';
import { Input } from '../../components/ui/Input';
import { accountStatusClass, accountStatusLabel, formatDate } from '../../lib/admin-format';

export type AdminAccount = {
  id: string;
  slug: string;
  legalName: string;
  tradeName: string;
  email: string;
  status: string;
  billingMode: string;
  sourceLabel: string;
  plan: { id: string; name: string; slug: string } | null;
  unitsCount: number;
  owner: { id: string; name: string; email: string } | null;
  trialEndsAt: string | null;
  accessValidUntil: string | null;
  manualAccessReason: string | null;
  createdAt: string;
  activatedAt: string | null;
  suspendedAt: string | null;
};

export function AdminAccountsPage() {
  const [q, setQ] = useState('');
  const [submitted, setSubmitted] = useState('');

  const accounts = useQuery({
    queryKey: ['adminAccounts', submitted],
    queryFn: () => {
      const params = submitted ? `?q=${encodeURIComponent(submitted)}` : '';
      return apiFetch<AdminAccount[]>(`/admin/accounts${params}`);
    },
  });

  if (accounts.isError) {
    return (
      <AdminEmptyState
        title="Não foi possível carregar as contas"
        description="A lista de tenants não está disponível agora. Tente novamente."
        onRetry={() => void accounts.refetch()}
      />
    );
  }

  const rows = accounts.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Contas</h1>
          <p className="text-sm text-slate-600">Tenants da plataforma — plano, status, unidades e responsável.</p>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(q.trim());
          }}
        >
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nome, e-mail ou slug" />
          <button
            type="submit"
            className="h-10 rounded-md bg-cyan-600 px-3 text-sm font-medium text-white hover:bg-cyan-700"
          >
            Buscar
          </button>
        </form>
      </div>

      {accounts.isLoading ? (
        <div className="h-48 animate-pulse rounded-2xl bg-slate-200/70" />
      ) : rows.length === 0 ? (
        <AdminEmptyState
          title="Nenhuma conta encontrada"
          description={submitted ? 'Nenhum tenant corresponde à busca.' : 'Ainda não há contas de clientes.'}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Conta</th>
                <th className="px-4 py-3 font-medium">Plano</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Cobrança</th>
                <th className="px-4 py-3 font-medium">Unidades</th>
                <th className="px-4 py-3 font-medium">Responsável</th>
                <th className="px-4 py-3 font-medium">Datas</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <Link to={`/admin/contas/${row.id}`} className="font-medium text-cyan-700 hover:underline">
                      {row.tradeName}
                    </Link>
                    <div className="text-xs text-slate-500">{row.slug}</div>
                  </td>
                  <td className="px-4 py-3">{row.plan?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ring-1 ${accountStatusClass(row.status)}`}>
                      {accountStatusLabel(row.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">{row.sourceLabel}</td>
                  <td className="px-4 py-3">{row.unitsCount}</td>
                  <td className="px-4 py-3">
                    <div>{row.owner?.name ?? '—'}</div>
                    <div className="text-xs text-slate-500">{row.owner?.email ?? ''}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    <div>Criada {formatDate(row.createdAt)}</div>
                    {row.trialEndsAt && <div>Trial até {formatDate(row.trialEndsAt)}</div>}
                    {row.accessValidUntil && <div>Acesso até {formatDate(row.accessValidUntil)}</div>}
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
