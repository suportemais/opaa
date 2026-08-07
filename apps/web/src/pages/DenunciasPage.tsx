import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import {
  whistleblowerCategoryLabel,
  whistleblowerPriorityClass,
  whistleblowerPriorityLabel,
  whistleblowerStatusClass,
  whistleblowerStatusLabel,
} from '../lib/labels';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';

type WhistleblowerRow = {
  id: string;
  protocol: string;
  category: string;
  customCategory: string | null;
  title: string;
  status: string;
  priority: string;
  reporterAnonymous: boolean;
  reporterName: string | null;
  reporterEmail: string | null;
  reporterPhone: string | null;
  createdAt: string;
  unit: { id: string; name: string } | null;
};

type Unit = { id: string; name: string };

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'any', label: 'Todas' },
  { value: 'moral_harassment', label: 'Assédio moral' },
  { value: 'sexual_harassment', label: 'Assédio sexual' },
  { value: 'discrimination', label: 'Discriminação' },
  { value: 'racism', label: 'Racismo' },
  { value: 'fraud', label: 'Fraude' },
  { value: 'corruption', label: 'Corrupção' },
  { value: 'conflict_of_interest', label: 'Conflito de interesses' },
  { value: 'policy_violation', label: 'Violação de políticas internas' },
  { value: 'work_safety', label: 'Segurança do trabalho' },
  { value: 'lgpd_privacy', label: 'LGPD / privacidade' },
  { value: 'misconduct', label: 'Conduta inadequada' },
  { value: 'other', label: 'Outro' },
];

export function DenunciasPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [status, setStatus] = useState<string>(() => searchParams.get('status') ?? 'any');
  const [priority, setPriority] = useState<string>(() => searchParams.get('priority') ?? 'any');
  const [category, setCategory] = useState<string>(() => searchParams.get('category') ?? 'any');
  const [from, setFrom] = useState(searchParams.get('from') ?? '');
  const [to, setTo] = useState(searchParams.get('to') ?? '');
  const [unitId, setUnitId] = useState(searchParams.get('unitId') ?? '');
  const [identified, setIdentified] = useState<string>(() => searchParams.get('identified') ?? 'any');
  const [q, setQ] = useState(searchParams.get('q') ?? '');

  const units = useQuery({ queryKey: ['units'], queryFn: () => apiFetch<Unit[]>('/units') });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (status && status !== 'any') params.set('status', status);
    if (priority && priority !== 'any') params.set('priority', priority);
    if (category && category !== 'any') params.set('category', category);
    if (identified && identified !== 'any') params.set('identified', identified);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (unitId) params.set('unitId', unitId);
    if (q.trim()) params.set('q', q.trim());
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }, [status, priority, category, identified, from, to, unitId, q]);

  useEffect(() => {
    setSearchParams(new URLSearchParams(queryString.replace(/^\?/, '')), { replace: true });
  }, [queryString, setSearchParams]);

  const rows = useQuery({
    queryKey: ['whistleblower', queryString],
    queryFn: () => apiFetch<WhistleblowerRow[]>(`/whistleblower${queryString}`),
  });

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xl font-semibold">Denúncias</div>
          <div className="text-sm text-slate-600">Listagem de denúncias recebidas pelo canal de ética e conformidade</div>
        </div>
      </div>

      <Card title="Filtros" description="Filtre por status, prioridade, categoria, unidade e identificação">
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600">Status</div>
            <select
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="any">Todos</option>
              <option value="received">Recebida</option>
              <option value="analyzing">Em análise</option>
              <option value="investigating">Em investigação</option>
              <option value="awaiting_info">Aguardando informações</option>
              <option value="completed">Concluída</option>
              <option value="archived">Arquivada</option>
            </select>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600">Prioridade</div>
            <select
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="any">Todas</option>
              <option value="low">Baixa</option>
              <option value="medium">Média</option>
              <option value="high">Alta</option>
              <option value="critical">Crítica</option>
            </select>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600">Categoria</div>
            <select
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600">Identificação</div>
            <select
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              value={identified}
              onChange={(e) => setIdentified(e.target.value)}
            >
              <option value="any">Todas</option>
              <option value="anonymous">Anônimas</option>
              <option value="identified">Identificadas</option>
            </select>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600">De</div>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600">Até</div>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600">Unidade</div>
            <select
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              disabled={units.isLoading}
            >
              <option value="">Todas</option>
              {units.data?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600">Busca</div>
            <Input
              placeholder="Protocolo, título ou denunciante"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
      </Card>

      <Card>
        {rows.isLoading && <div className="text-sm text-slate-600">Carregando...</div>}
        {rows.isError && <div className="text-sm text-rose-700">Falha ao carregar denúncias</div>}
        {rows.data && rows.data.length === 0 && <div className="text-sm text-slate-600">Sem denúncias</div>}
        {rows.data && rows.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-2 font-medium">Protocolo</th>
                  <th className="px-2 py-2 font-medium">Categoria</th>
                  <th className="px-2 py-2 font-medium">Data</th>
                  <th className="px-2 py-2 font-medium">Unidade</th>
                  <th className="px-2 py-2 font-medium">Identificação</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Prioridade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700">
                {rows.data.map((r) => {
                  const identified = !r.reporterAnonymous;
                  return (
                    <tr key={r.id} className="align-top hover:bg-slate-50">
                      <td className="px-2 py-3 align-top">
                        <div className="flex flex-col gap-1">
                          <Link to={`/app/whistleblower/${r.id}`} className="font-mono text-xs font-semibold text-sky-700 hover:underline">
                            {r.protocol}
                          </Link>
                          <div className="font-medium text-slate-900">{r.title}</div>
                          <div className="text-xs text-slate-500">
                            {r.category === 'other' && r.customCategory ? r.customCategory : whistleblowerCategoryLabel(r.category)}
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-3 align-top text-xs">
                        {r.category === 'other' && r.customCategory ? r.customCategory : whistleblowerCategoryLabel(r.category)}
                      </td>
                      <td className="px-2 py-3 align-top text-xs text-slate-700">{formatDate(r.createdAt)}</td>
                      <td className="px-2 py-3 align-top text-xs text-slate-700">{r.unit?.name ?? '—'}</td>
                      <td className="px-2 py-3 align-top">
                        {identified ? (
                          <div>
                            <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
                              Identificado
                            </span>
                            {r.reporterName && <div className="mt-1 text-xs text-slate-700">{r.reporterName}</div>}
                            {!r.reporterName && (r.reporterEmail || r.reporterPhone) && (
                              <div className="mt-1 text-xs text-slate-600">{r.reporterEmail ?? r.reporterPhone}</div>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                            Anônimo
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-3 align-top">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${whistleblowerStatusClass(r.status)}`}>
                          {whistleblowerStatusLabel(r.status)}
                        </span>
                      </td>
                      <td className="px-2 py-3 align-top">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${whistleblowerPriorityClass(r.priority)}`}>
                          {whistleblowerPriorityLabel(r.priority)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
