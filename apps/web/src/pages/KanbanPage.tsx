import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { apiFetch } from '../lib/api';
import { feedbackCasePriorityLabel, feedbackCaseStatusLabel, npsClassLabel } from '../lib/labels';

type KanbanItem = {
  id: string;
  status: string;
  priority: string;
  dueAt: string | null;
  updatedAt: string;
  createdAt: string;
  assigneeUserId: string | null;
  assignee: { id: string; name: string; email: string } | null;
  unit: { id: string; name: string } | null;
  customer: { id: string; name: string | null; email: string | null; phone: string | null; doNotContact: boolean } | null;
  surveyResponse: { id: string; completedAt: string | null; npsScore: number | null; npsClass: string | null; mainComment: string | null };
};

type Column = { status: string; title: string };

const columns: Column[] = [
  { status: 'new', title: 'Nova' },
  { status: 'viewed', title: 'Visualizada' },
  { status: 'in_progress', title: 'Em andamento' },
  { status: 'waiting_customer', title: 'Aguardando cliente' },
  { status: 'resolved', title: 'Resolvida' },
];

function formatDate(value: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function dueBadge(dueAt: string | null) {
  if (!dueAt) return null;
  const d = new Date(dueAt);
  if (Number.isNaN(d.getTime())) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const isOverdue = d.getTime() < start.getTime();
  const isToday = d.getTime() >= start.getTime() && d.getTime() < end.getTime();
  if (isOverdue) return { label: `Vencida ${formatDate(dueAt)}`, cls: 'bg-rose-100 text-rose-700' };
  if (isToday) return { label: `Vence hoje`, cls: 'bg-amber-100 text-amber-700' };
  return { label: `Vence ${formatDate(dueAt)}`, cls: 'bg-slate-100 text-slate-700' };
}

export function KanbanPage() {
  const qc = useQueryClient();

  const [searchParams, setSearchParams] = useSearchParams();

  const [assignee, setAssignee] = useState<'any' | 'me' | 'unassigned'>(() => {
    const v = searchParams.get('assignee');
    if (v === 'any' || v === 'me' || v === 'unassigned') return v;
    return 'any';
  });
  const [due, setDue] = useState<'any' | 'overdue' | 'today' | 'next7'>(() => {
    const v = searchParams.get('due');
    if (v === 'any' || v === 'overdue' || v === 'today' || v === 'next7') return v;
    return 'any';
  });
  const [showClosed, setShowClosed] = useState(() => searchParams.get('case') === 'with');

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set('case', showClosed ? 'with' : 'open');
    if (assignee !== 'any') params.set('assignee', assignee);
    if (due !== 'any') params.set('due', due);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }, [assignee, due, showClosed]);

  useEffect(() => {
    const next = new URLSearchParams(queryString.replace(/^\?/, ''));
    setSearchParams(next, { replace: true });
  }, [queryString, setSearchParams]);

  const data = useQuery({
    queryKey: ['kanban', queryString],
    queryFn: () => apiFetch<KanbanItem[]>(`/feedbacks/kanban${queryString}`),
  });

  const updateStatus = useMutation({
    mutationFn: async (payload: { responseId: string; status: string }) => {
      return apiFetch(`/feedbacks/${payload.responseId}/case`, {
        method: 'PATCH',
        json: { status: payload.status },
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['kanban'] });
      await qc.invalidateQueries({ queryKey: ['feedbacks'] });
    },
  });

  const grouped = useMemo(() => {
    const map = new Map<string, KanbanItem[]>();
    for (const c of columns) map.set(c.status, []);
    if (showClosed) {
      map.set('closed', []);
      map.set('dismissed', []);
    }
    for (const item of data.data ?? []) {
      const bucket = map.get(item.status);
      if (bucket) bucket.push(item);
      else map.set(item.status, [item]);
    }
    return map;
  }, [data.data, showClosed]);

  const extraColumns = useMemo(() => {
    return showClosed
      ? [
          { status: 'closed', title: 'Encerrada' },
          { status: 'dismissed', title: 'Descartada' },
        ]
      : [];
  }, [showClosed]);

  return (
    <div className="grid gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xl font-semibold">Kanban</div>
          <div className="text-sm text-slate-600">Fila visual de ocorrências</div>
        </div>
        <Link to="/app/feedbacks" className="text-sm text-slate-600 hover:underline">
          Voltar
        </Link>
      </div>

      <Card title="Filtros" description="Organize a fila por responsável e vencimento">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600">Responsável</div>
            <select
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value as any)}
            >
              <option value="any">Todos</option>
              <option value="me">Atribuídas a mim</option>
              <option value="unassigned">Sem responsável</option>
            </select>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600">Vencimento</div>
            <select
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              value={due}
              onChange={(e) => setDue(e.target.value as any)}
            >
              <option value="any">Todos</option>
              <option value="overdue">Vencidas</option>
              <option value="today">Vencendo hoje</option>
              <option value="next7">Próx. 7 dias</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
              Mostrar encerradas/descartadas
            </label>
          </div>
        </div>
      </Card>

      {data.isLoading && <div className="text-sm text-slate-600">Carregando...</div>}
      {data.isError && <div className="text-sm text-rose-700">Falha ao carregar</div>}

      {data.data && (
        <div className="flex gap-4 overflow-auto pb-2">
          {[...columns, ...extraColumns].map((col) => (
            <div
              key={col.status}
              className="w-[320px] shrink-0"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const responseId = e.dataTransfer.getData('text/responseId');
                if (!responseId) return;
                updateStatus.mutate({ responseId, status: col.status });
              }}
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">{col.title}</div>
                <div className="text-xs text-slate-500">{grouped.get(col.status)?.length ?? 0}</div>
              </div>

              <div className="grid gap-2">
                {(grouped.get(col.status) ?? []).map((item) => {
                  const b = dueBadge(item.dueAt);
                  const title = item.surveyResponse.mainComment?.trim() || 'Sem comentário';
                  const customer =
                    item.customer?.name?.trim() ||
                    item.customer?.email?.trim() ||
                    item.customer?.phone?.trim() ||
                    'Anônimo';

                  return (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/responseId', item.surveyResponse.id);
                      }}
                      className="cursor-grab rounded-md border border-slate-200 bg-white p-3 active:cursor-grabbing"
                    >
                      <Link to={`/app/feedbacks/${item.surveyResponse.id}`} className="block">
                        <div className="flex items-start justify-between gap-2">
                          <div
                            className={[
                              'inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-semibold',
                              item.surveyResponse.npsClass === 'detractor' ? 'bg-rose-100 text-rose-700' : '',
                              item.surveyResponse.npsClass === 'passive' ? 'bg-amber-100 text-amber-700' : '',
                              item.surveyResponse.npsClass === 'promoter' ? 'bg-emerald-100 text-emerald-700' : '',
                            ].join(' ')}
                          >
                            {item.surveyResponse.npsScore ?? '—'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-slate-900">{title}</div>
                            <div className="truncate text-xs text-slate-500">{customer}</div>
                          </div>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700">
                            {feedbackCasePriorityLabel(item.priority)}
                          </span>
                          {item.assignee ? (
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700">{item.assignee.name}</span>
                          ) : (
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700">Sem responsável</span>
                          )}
                          {b ? <span className={`rounded px-2 py-0.5 ${b.cls}`}>{b.label}</span> : null}
                          {item.customer?.doNotContact ? (
                            <span className="rounded bg-rose-100 px-2 py-0.5 text-rose-700">Não contatar</span>
                          ) : null}
                        </div>
                      </Link>

                      <div className="mt-2 text-[11px] text-slate-400">
                        {feedbackCaseStatusLabel(item.status)} • {npsClassLabel(item.surveyResponse.npsClass)}
                        {item.unit?.name ? ` • ${item.unit.name}` : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
