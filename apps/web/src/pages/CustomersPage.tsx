import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, apiFetch } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

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

function toCsvRows(rows: Array<Record<string, string>>) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const headers = Object.keys(rows[0] ?? {});
  const out = [headers.map(escape).join(',')];
  for (const r of rows) out.push(headers.map((h) => escape(r[h] ?? '')).join(','));
  return out.join('\n');
}

export function CustomersPage() {
  const [q, setQ] = useState('');
  const query = useMemo(() => q.trim(), [q]);

  const customers = useQuery({
    queryKey: ['customers', query],
    queryFn: () => apiFetch<Customer[]>(`/customers${query ? `?q=${encodeURIComponent(query)}` : ''}`),
  });

  function exportCsv() {
    if (!customers.data || customers.data.length === 0) return;
    const rows = customers.data.map((c) => ({
      id: c.id,
      name: c.name ?? '',
      email: c.email ?? '',
      phone: c.phone ?? '',
      lastInteractionAt: c.lastInteractionAt ?? '',
      createdAt: c.createdAt ?? '',
    }));
    const csv = toCsvRows(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clientes.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPrint() {
    if (!customers.data || customers.data.length === 0) return;
    const rows = customers.data
      .map(
        (c) => `
        <tr>
          <td>${(c.name ?? '—').replace(/</g, '&lt;')}</td>
          <td>${(c.email ?? '—').replace(/</g, '&lt;')}</td>
          <td>${(c.phone ?? '—').replace(/</g, '&lt;')}</td>
          <td>${formatDateTime(c.lastInteractionAt).replace(/</g, '&lt;')}</td>
        </tr>`,
      )
      .join('');
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Clientes</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; padding: 24px; color: #0f172a; }
    h1 { font-size: 18px; margin: 0 0 12px; }
    .meta { font-size: 12px; color: #64748b; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 8px; text-align: left; vertical-align: top; }
    th { color: #475569; font-weight: 600; }
  </style>
</head>
<body>
  <h1>Clientes</h1>
  <div class="meta">Exportado em ${new Date().toLocaleString()}</div>
  <table>
    <thead>
      <tr>
        <th>Nome</th>
        <th>E-mail</th>
        <th>Telefone</th>
        <th>Última interação</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  }

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
        <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
          <Button variant="secondary" disabled={!customers.data || customers.data.length === 0} onClick={exportCsv}>
            Exportar (CSV)
          </Button>
          <Button variant="secondary" disabled={!customers.data || customers.data.length === 0} onClick={exportPrint}>
            Exportar (PDF)
          </Button>
        </div>
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
