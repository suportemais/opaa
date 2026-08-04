import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { feedbackCaseStatusLabel } from '../lib/labels';
import { Card } from '../components/ui/Card';

type Feedback = {
  id: string;
  completedAt: string | null;
  npsScore: number | null;
  npsClass: string | null;
  mainComment: string | null;
  feedbackCase: {
    id: string;
    status: string;
    priority: string;
    dueAt: string | null;
    assigneeUserId: string | null;
    assignee: { id: string; name: string; email: string } | null;
  } | null;
};

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

export function FeedbacksPage() {
  const [caseFilter, setCaseFilter] = useState<'open' | 'with' | 'none' | 'all'>('open');
  const [assignee, setAssignee] = useState<'any' | 'me' | 'unassigned'>('any');
  const [due, setDue] = useState<'any' | 'overdue' | 'today' | 'next7'>('any');

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (caseFilter !== 'all') params.set('case', caseFilter);
    if (assignee !== 'any') params.set('assignee', assignee);
    if (due !== 'any') params.set('due', due);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }, [assignee, caseFilter, due]);

  const feedbacks = useQuery({
    queryKey: ['feedbacks', queryString],
    queryFn: () => apiFetch<Feedback[]>(`/feedbacks${queryString}`),
  });

  return (
    <div className="grid gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xl font-semibold">Central de feedbacks</div>
          <div className="text-sm text-slate-600">Respostas concluídas e tratativas</div>
        </div>
        <Link to="/app/feedbacks/kanban" className="text-sm text-slate-600 hover:underline">
          Ver Kanban
        </Link>
      </div>

      <Card title="Fila" description="Filtre ocorrências abertas e priorize por vencimento e responsável">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600">Ocorrências</div>
            <select
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              value={caseFilter}
              onChange={(e) => setCaseFilter(e.target.value as any)}
            >
              <option value="open">Abertas</option>
              <option value="with">Com ocorrência</option>
              <option value="none">Sem ocorrência</option>
              <option value="all">Todas</option>
            </select>
          </div>
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
        </div>
      </Card>

      <Card>
        {feedbacks.isLoading && <div className="text-sm text-slate-600">Carregando...</div>}
        {feedbacks.isError && <div className="text-sm text-rose-700">Falha ao carregar</div>}
        {feedbacks.data && feedbacks.data.length === 0 && <div className="text-sm text-slate-600">Sem respostas</div>}
        {feedbacks.data && feedbacks.data.length > 0 && (
          <div className="divide-y divide-slate-200">
            {feedbacks.data.map((f) => (
              <Link
                key={f.id}
                to={`/app/feedbacks/${f.id}`}
                className="flex items-center justify-between gap-4 py-3 hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={[
                        'inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-semibold',
                        f.npsClass === 'detractor' ? 'bg-rose-100 text-rose-700' : '',
                        f.npsClass === 'passive' ? 'bg-amber-100 text-amber-700' : '',
                        f.npsClass === 'promoter' ? 'bg-emerald-100 text-emerald-700' : '',
                      ].join(' ')}
                    >
                      {f.npsScore ?? '—'}
                    </span>
                    <div className="truncate text-sm font-medium text-slate-900">
                      {f.mainComment ? f.mainComment : 'Sem comentário'}
                    </div>
                  </div>
                  <div className="text-xs text-slate-500">
                    {f.feedbackCase ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span>Ocorrência: {feedbackCaseStatusLabel(f.feedbackCase.status)}</span>
                        {f.feedbackCase.assignee ? (
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700">
                            {f.feedbackCase.assignee.name}
                          </span>
                        ) : null}
                        {(() => {
                          const b = dueBadge(f.feedbackCase.dueAt);
                          return b ? <span className={`rounded px-2 py-0.5 ${b.cls}`}>{b.label}</span> : null;
                        })()}
                      </div>
                    ) : (
                      'Sem ocorrência'
                    )}
                  </div>
                </div>
                <div className="shrink-0 font-mono text-xs text-slate-400">{f.id.slice(0, 8)}</div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
