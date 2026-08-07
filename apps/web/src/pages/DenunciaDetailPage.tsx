import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import {
  whistleblowerCategoryLabel,
  whistleblowerEventLabel,
  whistleblowerPriorityClass,
  whistleblowerPriorityLabel,
  whistleblowerStatusClass,
  whistleblowerStatusLabel,
} from '../lib/labels';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

type WhistleblowerDetail = {
  id: string;
  protocol: string;
  publicToken: string;
  category: string;
  customCategory: string | null;
  title: string;
  description: string;
  occurredAt: string | null;
  locationText: string | null;
  involvedPeople: string | null;
  witnesses: string | null;
  additionalInfo: string | null;
  status: string;
  priority: string;
  reporterAnonymous: boolean;
  reporterName: string | null;
  reporterEmail: string | null;
  reporterPhone: string | null;
  reporterDoc: string | null;
  assigneeUserId: string | null;
  createdAt: string;
  updatedAt: string;
  unit: { id: string; name: string } | null;
  assignee: { id: string; name: string; email: string } | null;
  events: Array<{
    id: string;
    type: string;
    fromStatus: string | null;
    toStatus: string | null;
    notes: string | null;
    assigneeUserId: string | null;
    createdById: string | null;
    createdAt: string;
    createdBy: { id: string; name: string; email: string } | null;
    assignee: { id: string; name: string; email: string } | null;
  }>;
};

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function DenunciaDetailPage() {
  const params = useParams();
  const id = params.id ?? '';
  const qc = useQueryClient();

  const detail = useQuery({
    queryKey: ['whistleblower', id],
    queryFn: () => apiFetch<WhistleblowerDetail>(`/whistleblower/${id}`),
    enabled: Boolean(id),
  });

  const [status, setStatus] = useState<string>('received');
  const [priority, setPriority] = useState<string>('medium');
  const [notes, setNotes] = useState('');
  const [comment, setComment] = useState('');

  const initialState = useMemo(() => {
    const r = detail.data;
    return { status: r?.status ?? 'received', priority: r?.priority ?? 'medium' };
  }, [detail.data?.id, detail.data?.status, detail.data?.priority]);

  useEffect(() => {
    if (!detail.data) return;
    setStatus(initialState.status);
    setPriority(initialState.priority);
  }, [detail.data?.id, initialState.status, initialState.priority]);

  const save = useMutation({
    mutationFn: async () =>
      apiFetch(`/whistleblower/${id}`, {
        method: 'PATCH',
        json: {
          status,
          priority,
          notes: notes.trim() || undefined,
        },
      }),
    onSuccess: async () => {
      setNotes('');
      await qc.invalidateQueries({ queryKey: ['whistleblower', id] });
    },
  });

  const addComment = useMutation({
    mutationFn: async () =>
      apiFetch(`/whistleblower/${id}/events`, {
        method: 'POST',
        json: { notes: comment.trim() },
      }),
    onSuccess: async () => {
      setComment('');
      await qc.invalidateQueries({ queryKey: ['whistleblower', id] });
    },
  });

  const r = detail.data;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/app/whistleblower" className="text-sm text-slate-600 hover:underline">
            ← Voltar para denúncias
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <div className="text-xl font-semibold text-slate-900">Denúncia</div>
            <span className="font-mono text-sm text-slate-700">{r?.protocol ?? '...'}</span>
            {r?.status && (
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${whistleblowerStatusClass(r.status)}`}>
                {whistleblowerStatusLabel(r.status)}
              </span>
            )}
            {r?.priority && (
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${whistleblowerPriorityClass(r.priority)}`}>
                {whistleblowerPriorityLabel(r.priority)}
              </span>
            )}
          </div>
          <div className="text-sm text-slate-600">Recebida em {formatDate(r?.createdAt)}</div>
        </div>
      </div>

      {detail.isLoading && <div className="text-sm text-slate-600">Carregando...</div>}
      {detail.isError && <div className="text-sm text-rose-700">Falha ao carregar detalhes</div>}

      {r && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2 grid gap-4">
            <Card title="Conteúdo da denúncia">
              <div className="grid gap-3 text-sm">
                <div>
                  <div className="mb-1 text-xs font-medium text-slate-600">Categoria</div>
                  <div className="font-medium text-slate-900">
                    {r.category === 'other' && r.customCategory ? r.customCategory : whistleblowerCategoryLabel(r.category)}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-slate-600">Título / Assunto</div>
                  <div className="font-medium text-slate-900">{r.title}</div>
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-slate-600">Descrição detalhada</div>
                  <div className="whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-slate-800">{r.description || '—'}</div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="mb-1 text-xs font-medium text-slate-600">Data aproximada do ocorrido</div>
                    <div className="text-slate-800">{r.occurredAt ? new Date(r.occurredAt).toLocaleDateString() : '—'}</div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-medium text-slate-600">Local / Unidade</div>
                    <div className="text-slate-800">{r.unit?.name ?? r.locationText ?? '—'}</div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-medium text-slate-600">Local (texto livre)</div>
                    <div className="text-slate-800">{r.locationText || '—'}</div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-medium text-slate-600">Pessoas envolvidas</div>
                    <div className="whitespace-pre-wrap text-slate-800">{r.involvedPeople || '—'}</div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-medium text-slate-600">Testemunhas</div>
                    <div className="whitespace-pre-wrap text-slate-800">{r.witnesses || '—'}</div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-medium text-slate-600">Informações adicionais</div>
                    <div className="whitespace-pre-wrap text-slate-800">{r.additionalInfo || '—'}</div>
                  </div>
                </div>
              </div>
            </Card>

            <Card title="Identificação do denunciante">
              {r.reporterAnonymous ? (
                <div className="text-sm text-slate-700">
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">Anônimo</span>
                  <div className="mt-2 text-slate-600">O denunciante optou por não se identificar.</div>
                </div>
              ) : (
                <div className="grid gap-2 text-sm md:grid-cols-2">
                  <div>
                    <div className="mb-1 text-xs font-medium text-slate-600">Nome</div>
                    <div className="font-medium text-slate-900">{r.reporterName ?? '—'}</div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-medium text-slate-600">E-mail</div>
                    <div className="text-slate-800">{r.reporterEmail ?? '—'}</div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-medium text-slate-600">Telefone</div>
                    <div className="text-slate-800">{r.reporterPhone ?? '—'}</div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-medium text-slate-600">Documento</div>
                    <div className="text-slate-800">{r.reporterDoc ?? '—'}</div>
                  </div>
                </div>
              )}
            </Card>

            <Card title="Histórico e comentários" description="Anotações internas e alterações de status/prioridade/responsável">
              <div className="grid gap-3">
                {r.events.length === 0 && <div className="text-sm text-slate-600">Sem eventos ainda.</div>}
                {r.events.map((e) => (
                  <div key={e.id} className="rounded-md border border-slate-200 bg-white p-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                        {whistleblowerEventLabel(e.type)}
                      </span>
                      {e.fromStatus && e.toStatus && (
                        <span>
                          {whistleblowerStatusLabel(e.fromStatus)} → {whistleblowerStatusLabel(e.toStatus)}
                        </span>
                      )}
                      {e.assignee && (
                        <span>
                          Responsável: <span className="font-medium text-slate-700">{e.assignee.name}</span>
                        </span>
                      )}
                      <span className="ml-auto">{formatDate(e.createdAt)}</span>
                      {e.createdBy && (
                        <span className="text-slate-700">
                          por <span className="font-medium">{e.createdBy.name}</span>
                        </span>
                      )}
                    </div>
                    {e.notes && <div className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{e.notes}</div>}
                  </div>
                ))}
              </div>

              <div className="mt-5 grid gap-3">
                <div>
                  <div className="mb-1 text-xs font-medium text-slate-600">Adicionar comentário / anotação</div>
                  <textarea
                    className="min-h-24 w-full resize-none rounded-md border border-slate-200 bg-white p-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                    placeholder="Observações internas (não é visível ao denunciante)"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => addComment.mutate()} disabled={!comment.trim() || addComment.isPending}>
                    {addComment.isPending ? 'Salvando...' : 'Adicionar anotação'}
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid gap-4 content-start">
            <Card title="Gestão do caso">
              <div className="grid gap-3 text-sm">
                <div>
                  <div className="mb-1 text-xs font-medium text-slate-600">Status</div>
                  <select
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
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
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                    <option value="critical">Crítica</option>
                  </select>
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-slate-600">Unidade vinculada</div>
                  <div className="rounded-md bg-slate-50 p-2 text-slate-800">{r.unit?.name ?? '—'}</div>
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-slate-600">Responsável atual</div>
                  <div className="rounded-md bg-slate-50 p-2 text-slate-800">{r.assignee?.name ?? '—'}</div>
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-slate-600">Notas (opcional)</div>
                  <textarea
                    className="min-h-20 w-full resize-none rounded-md border border-slate-200 bg-white p-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Motivo da alteração"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    onClick={() => save.mutate()}
                    disabled={
                      save.isPending ||
                      (status === initialState.status && priority === initialState.priority && !notes.trim())
                    }
                  >
                    {save.isPending ? 'Salvando...' : 'Salvar alterações'}
                  </Button>
                </div>
              </div>
            </Card>

            <Card title="Protocolo e links" description="Dados para consulta e acompanhamento">
              <div className="grid gap-2 text-sm">
                <div>
                  <div className="mb-1 text-xs font-medium text-slate-600">Protocolo</div>
                  <div className="font-mono text-sm text-slate-900">{r.protocol}</div>
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-slate-600">Token público</div>
                  <div className="font-mono text-xs text-slate-700 break-all">{r.publicToken}</div>
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-slate-600">Última atualização</div>
                  <div className="text-slate-800">{formatDate(r.updatedAt)}</div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
