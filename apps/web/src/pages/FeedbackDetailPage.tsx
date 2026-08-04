import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { feedbackCaseEventLabel, feedbackCasePriorityLabel, feedbackCaseStatusLabel, interactionChannelLabel, npsClassLabel } from '../lib/labels';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

type Detail = {
  id: string;
  npsScore: number | null;
  npsClass: string | null;
  mainComment: string | null;
  customerId: string | null;
  customer: null | {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  answers: Array<{ id: string; question: { title: string; type: string }; value: unknown }>;
  feedbackCase: null | {
    id: string;
    status: string;
    priority: string;
    dueAt: string | null;
    assigneeUserId: string | null;
    events: Array<{ id: string; type: string; createdAt: string; createdBy?: { id: string; name: string; email: string } | null }>;
  };
};

type CaseInteraction = {
  id: string;
  channel: string;
  direction: string;
  outcome: string | null;
  notes: string | null;
  createdAt: string;
  createdByUser: { id: string; name: string; email: string } | null;
};

export function FeedbackDetailPage() {
  const params = useParams();
  const id = params.id ?? '';
  const qc = useQueryClient();

  const detail = useQuery({
    queryKey: ['feedback', id],
    queryFn: () => apiFetch<Detail>(`/feedbacks/${id}`),
    enabled: Boolean(id),
  });

  const interactions = useQuery({
    queryKey: ['feedback', id, 'caseInteractions'],
    queryFn: () => apiFetch<CaseInteraction[]>(`/feedbacks/${id}/case/interactions`),
    enabled: Boolean(id),
  });

  const [status, setStatus] = useState('new');
  const [dueAt, setDueAt] = useState('');
  const [channel, setChannel] = useState('whatsapp');
  const [outcome, setOutcome] = useState('');
  const [notes, setNotes] = useState('');

  const canLogInteraction = useMemo(() => Boolean(detail.data?.customerId), [detail.data?.customerId]);
  const customer = detail.data?.customer ?? null;
  const customerName = customer?.name?.trim() ? customer.name.trim() : 'Cliente';
  const customerEmail = customer?.email?.trim() ? customer.email.trim() : '';
  const customerPhone = customer?.phone?.trim() ? customer.phone.trim() : '';
  const customerPhoneDigits = customerPhone.replace(/\D+/g, '');
  const hasCustomer = Boolean(detail.data?.customerId && customer);

  const initialCaseState = useMemo(() => {
    const c = detail.data?.feedbackCase;
    return {
      status: c?.status ?? 'new',
      dueAt: c?.dueAt ? c.dueAt.slice(0, 10) : '',
    };
  }, [detail.data?.feedbackCase]);

  useEffect(() => {
    if (!detail.data?.feedbackCase) return;
    setStatus(initialCaseState.status);
    setDueAt(initialCaseState.dueAt);
  }, [detail.data?.feedbackCase?.id, initialCaseState.status, initialCaseState.dueAt]);

  const createCase = useMutation({
    mutationFn: async () => apiFetch(`/feedbacks/${id}/case`, { method: 'POST' }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['feedback', id] });
      await qc.invalidateQueries({ queryKey: ['feedback', id, 'caseInteractions'] });
    },
  });

  const assignMe = useMutation({
    mutationFn: async () => apiFetch(`/feedbacks/${id}/case/assign-me`, { method: 'POST' }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['feedback', id] });
    },
  });

  const saveCase = useMutation({
    mutationFn: async () =>
      apiFetch(`/feedbacks/${id}/case`, {
        method: 'PATCH',
        json: {
          status,
          dueAt: dueAt.trim() ? dueAt.trim() : undefined,
        },
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['feedback', id] });
    },
  });

  const createInteraction = useMutation({
    mutationFn: async () =>
      apiFetch(`/feedbacks/${id}/case/interactions`, {
        method: 'POST',
        json: { channel, direction: 'outbound', outcome: outcome.trim() || undefined, notes: notes.trim() || undefined },
      }),
    onSuccess: async () => {
      setOutcome('');
      setNotes('');
      await qc.invalidateQueries({ queryKey: ['feedback', id, 'caseInteractions'] });
      await qc.invalidateQueries({ queryKey: ['feedback', id] });
    },
  });

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xl font-semibold">Feedback</div>
          <div className="text-sm text-slate-600">Detalhes da resposta</div>
        </div>
        <Link to="/app/feedbacks" className="text-sm text-slate-600 hover:underline">
          Voltar
        </Link>
      </div>

      {detail.isLoading && <div className="text-sm text-slate-600">Carregando...</div>}
      {detail.isError && <div className="text-sm text-rose-700">Falha ao carregar</div>}

      {detail.data && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Resumo">
            <div className="grid gap-2 text-sm">
              <div className="flex items-center justify-between">
                <div className="text-slate-600">NPS</div>
                <div className="font-medium text-slate-900">
                  {detail.data.npsScore ?? '—'} ({npsClassLabel(detail.data.npsClass)})
                </div>
              </div>
              <div className="rounded-md bg-slate-50 p-3 text-slate-700">
                {detail.data.mainComment ? detail.data.mainComment : 'Sem comentário'}
              </div>
              <div className="font-mono text-xs text-slate-400">{detail.data.id}</div>
            </div>
          </Card>

          <Card title="Ocorrência">
            {detail.data.feedbackCase ? (
              <div className="grid gap-2 text-sm">
                <div className="rounded-md border border-slate-200 bg-white p-3">
                  <div className="mb-2 text-xs font-medium text-slate-600">Cliente</div>
                  {!hasCustomer && <div className="text-sm text-slate-700">Resposta sem identificação.</div>}
                  {hasCustomer && (
                    <div className="grid gap-1 text-sm">
                      <div className="font-medium text-slate-900">{customerName}</div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-700">
                        <div>
                          <span className="text-slate-500">E-mail: </span>
                          {customerEmail ? (
                            <a className="text-sky-700 hover:underline" href={`mailto:${customerEmail}`}>
                              {customerEmail}
                            </a>
                          ) : (
                            '—'
                          )}
                        </div>
                        <div>
                          <span className="text-slate-500">Telefone: </span>
                          {customerPhone ? (
                            <span className="inline-flex flex-wrap gap-2">
                              <a className="text-sky-700 hover:underline" href={`tel:${customerPhoneDigits || customerPhone}`}>
                                {customerPhone}
                              </a>
                              {customerPhoneDigits ? (
                                <a
                                  className="text-sky-700 hover:underline"
                                  href={`https://wa.me/${customerPhoneDigits}`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  WhatsApp
                                </a>
                              ) : null}
                            </span>
                          ) : (
                            '—'
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-slate-600">Status</div>
                  <div className="font-medium">{feedbackCaseStatusLabel(detail.data.feedbackCase.status)}</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-slate-600">Prioridade</div>
                  <div className="font-medium">{feedbackCasePriorityLabel(detail.data.feedbackCase.priority)}</div>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <div>
                    <div className="mb-1 text-xs font-medium text-slate-600">Atualizar status</div>
                    <select
                      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="new">Nova</option>
                      <option value="viewed">Visualizada</option>
                      <option value="in_progress">Em andamento</option>
                      <option value="waiting_customer">Aguardando cliente</option>
                      <option value="resolved">Resolvida</option>
                      <option value="closed">Encerrada</option>
                      <option value="dismissed">Descartada</option>
                    </select>
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-medium text-slate-600">Vencimento</div>
                    <Input
                      value={dueAt}
                      onChange={(e) => setDueAt(e.target.value)}
                      placeholder="YYYY-MM-DD"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button variant="secondary" disabled={assignMe.isPending} onClick={() => assignMe.mutate()}>
                    {assignMe.isPending ? 'Atribuindo...' : 'Atribuir para mim'}
                  </Button>
                  <Button disabled={saveCase.isPending} onClick={() => saveCase.mutate()}>
                    {saveCase.isPending ? 'Salvando...' : 'Salvar'}
                  </Button>
                </div>

                <div className="text-slate-600 pt-2">Contato</div>
                {!canLogInteraction && (
                  <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    Cliente não identificado. Para registrar contato, é necessário que o cliente se identifique na pesquisa.
                  </div>
                )}
                <div className="grid gap-2">
                  <div className="grid gap-2 md:grid-cols-[160px_1fr]">
                    <div>
                      <select
                        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm disabled:bg-slate-50 disabled:text-slate-400"
                        value={channel}
                        onChange={(e) => setChannel(e.target.value)}
                        disabled={!canLogInteraction}
                      >
                        <option value="whatsapp">WhatsApp</option>
                        <option value="phone">Telefone</option>
                        <option value="email">E-mail</option>
                        <option value="sms">SMS</option>
                        <option value="in_person">Presencial</option>
                      </select>
                    </div>
                    <div>
                      <Input
                        value={outcome}
                        onChange={(e) => setOutcome(e.target.value)}
                        placeholder="Resultado (opcional)"
                        disabled={!canLogInteraction}
                      />
                    </div>
                  </div>
                  <textarea
                    className="min-h-20 w-full resize-none rounded-md border border-slate-200 bg-white p-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 disabled:bg-slate-50 disabled:text-slate-400"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notas do contato (opcional)"
                    disabled={!canLogInteraction}
                  />
                  <div className="flex items-center justify-end">
                    <Button disabled={createInteraction.isPending || !canLogInteraction} onClick={() => createInteraction.mutate()}>
                      {createInteraction.isPending ? 'Registrando...' : 'Registrar contato'}
                    </Button>
                  </div>
                  {createInteraction.isError && (
                    <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">Falha ao registrar contato</div>
                  )}
                </div>

                <div className="text-slate-600">Eventos</div>
                <div className="divide-y divide-slate-200 rounded-md border border-slate-200">
                  {detail.data.feedbackCase.events.map((e) => (
                    <div key={e.id} className="flex items-center justify-between px-3 py-2">
                      <div className="text-xs text-slate-700">{feedbackCaseEventLabel(e.type)}</div>
                      <div className="text-xs text-slate-400">{new Date(e.createdAt).toLocaleString()}</div>
                    </div>
                  ))}
                </div>

                <div className="text-slate-600 pt-2">Histórico de contatos</div>
                {interactions.isLoading && <div className="text-sm text-slate-600">Carregando...</div>}
                {interactions.isError && <div className="text-sm text-rose-700">Falha ao carregar contatos</div>}
                {interactions.data && interactions.data.length === 0 && <div className="text-sm text-slate-600">Nenhum contato</div>}
                {interactions.data && interactions.data.length > 0 && (
                  <div className="divide-y divide-slate-200 rounded-md border border-slate-200">
                    {interactions.data.map((i) => (
                      <div key={i.id} className="grid gap-1 px-3 py-2 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="text-slate-700">{interactionChannelLabel(i.channel)}</div>
                          <div className="text-slate-400">{new Date(i.createdAt).toLocaleString()}</div>
                        </div>
                        <div className="text-slate-600">{i.outcome ?? '—'}</div>
                        {i.notes && <div className="text-slate-700">{i.notes}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="grid gap-3 text-sm">
                <div className="text-slate-600">Sem ocorrência gerada.</div>
                <div className="flex items-center justify-end">
                  <Button disabled={createCase.isPending} onClick={() => createCase.mutate()}>
                    {createCase.isPending ? 'Criando...' : 'Criar ocorrência'}
                  </Button>
                </div>
                {createCase.isError && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">Falha ao criar ocorrência</div>}
              </div>
            )}
          </Card>

          <div className="md:col-span-2">
            <Card title="Respostas">
              <div className="divide-y divide-slate-200">
                {detail.data.answers.map((a) => (
                  <div key={a.id} className="py-3">
                    <div className="text-sm font-medium text-slate-900">{a.question.title}</div>
                    <div className="text-sm text-slate-700">
                      {typeof a.value === 'string' || typeof a.value === 'number' ? String(a.value) : JSON.stringify(a.value)}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
