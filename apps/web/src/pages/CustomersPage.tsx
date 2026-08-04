import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, apiFetch } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';

type Customer = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  originUnitId: string | null;
  firstInteractionAt: string | null;
  lastInteractionAt: string | null;
  createdAt: string;
};

function formatDateTime(value: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

export function CustomersPage() {
  const [q, setQ] = useState('');
  const query = useMemo(() => q.trim(), [q]);

  const customers = useQuery({
    queryKey: ['customers', query],
    queryFn: () => apiFetch<Customer[]>(`/customers${query ? `?q=${encodeURIComponent(query)}` : ''}`),
  });

  return (
    <div className="grid gap-6">
      <div>
        <div className="text-xl font-semibold">Clientes</div>
        <div className="text-sm text-slate-600">Cadastros gerados a partir de identificações (opcional) na pesquisa</div>
      </div>

      <Card title="Buscar">
        <div className="grid gap-2">
          <div className="text-sm text-slate-600">Nome, e-mail ou telefone</div>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ex: Maria, maria@email.com, 11999999999" />
        </div>
      </Card>

      <Card title="Lista">
        {customers.isLoading && <div className="text-sm text-slate-600">Carregando...</div>}
        {customers.isError && (
          <div className="text-sm text-rose-700">
            {customers.error instanceof ApiError
              ? `Falha ao carregar clientes (${customers.error.status})`
              : 'Falha ao carregar clientes'}
          </div>
        )}
        {customers.data && customers.data.length === 0 && <div className="text-sm text-slate-600">Nenhum cliente</div>}
        {customers.data && customers.data.length > 0 && (
          <div className="overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-2 pr-3 font-medium">Nome</th>
                  <th className="py-2 pr-3 font-medium">E-mail</th>
                  <th className="py-2 pr-3 font-medium">Telefone</th>
                  <th className="py-2 pr-3 font-medium">Última interação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.data.map((c) => (
                  <tr key={c.id} className="align-top">
                    <td className="py-2 pr-3">
                      <Link to={`/app/customers/${c.id}`} className="font-medium text-sky-700 hover:underline">
                        {c.name ?? '—'}
                      </Link>
                      <div className="text-xs font-mono text-slate-400">{c.id}</div>
                    </td>
                    <td className="py-2 pr-3">{c.email ?? '—'}</td>
                    <td className="py-2 pr-3">{c.phone ?? '—'}</td>
                    <td className="py-2 pr-3">{formatDateTime(c.lastInteractionAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
