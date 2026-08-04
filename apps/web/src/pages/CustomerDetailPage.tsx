import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { feedbackCasePriorityLabel, feedbackCaseStatusLabel, interactionChannelLabel } from '../lib/labels';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

type Customer = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  firstInteractionAt: string | null;
  lastInteractionAt: string | null;
  doNotContact: boolean;
  doNotContactAt: string | null;
  doNotContactReason: string | null;
  tags: unknown;
  notes: string | null;
  createdAt: string;
};

type CustomerResponse = {
  id: string;
  startedAt: string;
  completedAt: string | null;
  npsScore: number | null;
  npsClass: string | null;
  mainComment: string | null;
  survey: { id: string; name: string };
  unit: { id: string; name: string } | null;
};

type CustomerCase = {
  id: string;
  status: string;
  priority: string;
  updatedAt: string;
  createdAt: string;
  description: string | null;
  unit: { id: string; name: string } | null;
  surveyResponse: { id: string; npsScore: number | null; npsClass: string | null };
};

type CustomerInteraction = {
  id: string;
  channel: string;
  direction: string;
  outcome: string | null;
  notes: string | null;
  createdAt: string;
  unit: { id: string; name: string } | null;
  createdByUser: { id: string; name: string; email: string } | null;
};

function formatDateTime(value: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function parseTags(value: string) {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 20);
}

export function CustomerDetailPage() {
  const params = useParams();
  const id = params.id ?? '';
  const qc = useQueryClient();

  const customer = useQuery({
    queryKey: ['customer', id],
    queryFn: () => apiFetch<Customer>(`/customers/${id}`),
    enabled: Boolean(id),
  });

  const tagsFromApi = useMemo(() => {
    const raw = customer.data?.tags;
    if (Array.isArray(raw) && raw.every((t) => typeof t === 'string')) return raw as string[];
    return [];
  }, [customer.data?.tags]);

  const [doNotContact, setDoNotContact] = useState(false);
  const [doNotContactReason, setDoNotContactReason] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [notes, setNotes] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (!customer.data) return;
    setDoNotContact(Boolean(customer.data.doNotContact));
    setDoNotContactReason(customer.data.doNotContactReason ?? '');
    setTagsText(tagsFromApi.join(', '));
    setNotes(customer.data.notes ?? '');
    setName(customer.data.name ?? '');
    setEmail(customer.data.email ?? '');
    setPhone(customer.data.phone ?? '');
  }, [customer.data, tagsFromApi]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      return apiFetch<Customer>(`/customers/${id}`, {
        method: 'PATCH',
        json: {
          name: name.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
        },
      });
    },
    onSuccess: async () => {
      setProfileOpen(false);
      await qc.invalidateQueries({ queryKey: ['customer', id] });
      await qc.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  const saveActions = useMutation({
    mutationFn: async () => {
      return apiFetch<Customer>(`/customers/${id}`, {
        method: 'PATCH',
        json: {
          doNotContact,
          doNotContactReason: doNotContact ? doNotContactReason : undefined,
          tags: parseTags(tagsText),
          notes,
        },
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['customer', id] });
      await qc.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  const responses = useQuery({
    queryKey: ['customerResponses', id],
    queryFn: () => apiFetch<CustomerResponse[]>(`/customers/${id}/responses`),
    enabled: Boolean(id),
  });

  const cases = useQuery({
    queryKey: ['customerCases', id],
    queryFn: () => apiFetch<CustomerCase[]>(`/customers/${id}/cases`),
    enabled: Boolean(id),
  });

  const interactions = useQuery({
    queryKey: ['customerInteractions', id],
    queryFn: () => apiFetch<CustomerInteraction[]>(`/customers/${id}/interactions`),
    enabled: Boolean(id),
  });

  const [channel, setChannel] = useState('whatsapp');
  const [outcome, setOutcome] = useState('');
  const [interactionNotes, setInteractionNotes] = useState('');

  const createInteraction = useMutation({
    mutationFn: async () => {
      return apiFetch<CustomerInteraction>(`/customers/${id}/interactions`, {
        method: 'POST',
        json: {
          channel,
          direction: 'outbound',
          outcome: outcome.trim() || undefined,
          notes: interactionNotes.trim() || undefined,
        },
      });
    },
    onSuccess: async () => {
      setOutcome('');
      setInteractionNotes('');
      await qc.invalidateQueries({ queryKey: ['customerInteractions', id] });
    },
  });

  if (!id) return <div className="text-sm text-rose-700">Cliente inválido</div>;

  return (
    <div className="grid gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xl font-semibold">Cliente</div>
          <div className="text-sm text-slate-600">Histórico e cadastros vinculados às respostas</div>
        </div>
        <Link to="/app/customers" className="text-sm text-slate-600 hover:underline">
          Voltar
        </Link>
      </div>

      <Card title="Dados">
        {customer.isLoading && <div className="text-sm text-slate-600">Carregando...</div>}
        {customer.isError && <div className="text-sm text-rose-700">Falha ao carregar cliente</div>}
        {customer.data && (
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-slate-600">Identificação e contato</div>
              <Button variant="secondary" onClick={() => setProfileOpen((v) => !v)}>
                {profileOpen ? 'Recolher' : 'Editar cadastro'}
              </Button>
            </div>

            {profileOpen ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="md:col-span-2">
                  <div className="mb-1 text-sm font-medium text-slate-700">Nome</div>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome (opcional)" />
                </div>
                <div>
                  <div className="mb-1 text-sm font-medium text-slate-700">E-mail</div>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail (opcional)" />
                </div>
                <div>
                  <div className="mb-1 text-sm font-medium text-slate-700">Telefone</div>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefone (opcional)" />
                </div>
                <div className="md:col-span-2 flex items-center justify-end gap-2">
                  <Button
                    variant="secondary"
                    disabled={saveProfile.isPending}
                    onClick={() => {
                      setProfileOpen(false);
                      setName(customer.data.name ?? '');
                      setEmail(customer.data.email ?? '');
                      setPhone(customer.data.phone ?? '');
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button disabled={saveProfile.isPending} onClick={() => saveProfile.mutate()}>
                    {saveProfile.isPending ? 'Salvando...' : 'Salvar'}
                  </Button>
                </div>
                {saveProfile.isError && (
                  <div className="md:col-span-2 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    Falha ao salvar cadastro
                  </div>
                )}
              </div>
            ) : (
              <div className="grid gap-2 text-sm">
                <div className="rounded-md bg-slate-50 p-3">
                  <div className="text-slate-500">Nome</div>
                  <div className="text-slate-900">{customer.data.name ?? '—'}</div>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="rounded-md bg-slate-50 p-3">
                    <div className="text-slate-500">E-mail</div>
                    <div className="text-slate-900">{customer.data.email ?? '—'}</div>
                  </div>
                  <div className="rounded-md bg-slate-50 p-3">
                    <div className="text-slate-500">Telefone</div>
                    <div className="text-slate-900">{customer.data.phone ?? '—'}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-2 md:grid-cols-2">
              <div className="rounded-md bg-slate-50 p-3">
                <div className="text-slate-500">Primeira interação</div>
                <div className="text-slate-900">{formatDateTime(customer.data.firstInteractionAt)}</div>
              </div>
              <div className="rounded-md bg-slate-50 p-3">
                <div className="text-slate-500">Última interação</div>
                <div className="text-slate-900">{formatDateTime(customer.data.lastInteractionAt)}</div>
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="rounded-md bg-slate-50 p-3">
                <div className="text-slate-500">Não contatar</div>
                <div className="text-slate-900">{customer.data.doNotContact ? 'Sim' : 'Não'}</div>
              </div>
              <div className="rounded-md bg-slate-50 p-3">
                <div className="text-slate-500">Ativado em</div>
                <div className="text-slate-900">{formatDateTime(customer.data.doNotContactAt)}</div>
              </div>
            </div>
            <div className="text-xs font-mono text-slate-400">{customer.data.id}</div>
          </div>
        )}
      </Card>

      <Card title="Ações" description="Controle operacional do CRM (tags, observações e preferências)">
        {!customer.data && <div className="text-sm text-slate-600">Carregue um cliente para editar</div>}
        {customer.data && (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white p-3">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={doNotContact}
                  onChange={(e) => setDoNotContact(e.target.checked)}
                />
                Não contatar
              </label>
              {doNotContact && (
                <div className="flex-1 min-w-[240px]">
                  <Input
                    value={doNotContactReason}
                    onChange={(e) => setDoNotContactReason(e.target.value)}
                    placeholder="Motivo (opcional)"
                  />
                </div>
              )}
              <div className="ml-auto flex items-center gap-2">
                <Button disabled={saveActions.isPending} onClick={() => saveActions.mutate()}>
                  {saveActions.isPending ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </div>

            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">Tags</div>
              <Input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="Ex: vip, reclamação, retorno" />
              <div className="mt-1 text-xs text-slate-500">Separe por vírgula</div>
            </div>

            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">Observações internas</div>
              <textarea
                className="min-h-28 w-full resize-none rounded-md border border-slate-200 bg-white p-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contexto do cliente, acordos, detalhes relevantes..."
              />
            </div>

            {saveActions.isError && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">Falha ao salvar</div>}
          </div>
        )}
      </Card>

      <Card title="Contato" description="Registre tentativas/retornos para apoiar recuperação e histórico">
        <div className="grid gap-3 md:grid-cols-[180px_1fr]">
          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">Canal</div>
            <select
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="phone">Telefone</option>
              <option value="email">E-mail</option>
              <option value="sms">SMS</option>
              <option value="in_person">Presencial</option>
            </select>
          </div>
          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">Resultado</div>
            <Input value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="Ex: respondeu, sem retorno, agendado" />
          </div>
          <div className="md:col-span-2">
            <div className="mb-1 text-sm font-medium text-slate-700">Notas</div>
            <textarea
              className="min-h-24 w-full resize-none rounded-md border border-slate-200 bg-white p-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              value={interactionNotes}
              onChange={(e) => setInteractionNotes(e.target.value)}
              placeholder="Resumo do contato (opcional)"
            />
          </div>
          <div className="md:col-span-2 flex items-center justify-end gap-2">
            <Button disabled={createInteraction.isPending} onClick={() => createInteraction.mutate()}>
              {createInteraction.isPending ? 'Registrando...' : 'Registrar contato'}
            </Button>
          </div>
        </div>

        <div className="mt-4">
          {interactions.isLoading && <div className="text-sm text-slate-600">Carregando...</div>}
          {interactions.isError && <div className="text-sm text-rose-700">Falha ao carregar histórico</div>}
          {interactions.data && interactions.data.length === 0 && <div className="text-sm text-slate-600">Nenhum contato registrado</div>}
          {interactions.data && interactions.data.length > 0 && (
            <div className="overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Data</th>
                    <th className="py-2 pr-3 font-medium">Canal</th>
                    <th className="py-2 pr-3 font-medium">Resultado</th>
                    <th className="py-2 pr-3 font-medium">Notas</th>
                    <th className="py-2 pr-3 font-medium">Operador</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {interactions.data.map((i) => (
                    <tr key={i.id} className="align-top">
                      <td className="py-2 pr-3 whitespace-nowrap">{formatDateTime(i.createdAt)}</td>
                      <td className="py-2 pr-3">{interactionChannelLabel(i.channel)}</td>
                      <td className="py-2 pr-3">{i.outcome ?? '—'}</td>
                      <td className="py-2 pr-3">{i.notes ?? '—'}</td>
                      <td className="py-2 pr-3">{i.createdByUser?.name ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      <Card title="Respostas" description="Pesquisas respondidas por este cliente">
        {responses.isLoading && <div className="text-sm text-slate-600">Carregando...</div>}
        {responses.isError && <div className="text-sm text-rose-700">Falha ao carregar respostas</div>}
        {responses.data && responses.data.length === 0 && <div className="text-sm text-slate-600">Nenhuma resposta</div>}
        {responses.data && responses.data.length > 0 && (
          <div className="overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-2 pr-3 font-medium">Data</th>
                  <th className="py-2 pr-3 font-medium">Pesquisa</th>
                  <th className="py-2 pr-3 font-medium">Unidade</th>
                  <th className="py-2 pr-3 font-medium">NPS</th>
                  <th className="py-2 pr-3 font-medium">Comentário</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {responses.data.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="py-2 pr-3 whitespace-nowrap">{formatDateTime(r.completedAt ?? r.startedAt)}</td>
                    <td className="py-2 pr-3">{r.survey.name}</td>
                    <td className="py-2 pr-3">{r.unit?.name ?? '—'}</td>
                    <td className="py-2 pr-3">{typeof r.npsScore === 'number' ? r.npsScore : '—'}</td>
                    <td className="py-2 pr-3">{r.mainComment ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Ocorrências" description="Casos abertos para detratores ou tratativas">
        {cases.isLoading && <div className="text-sm text-slate-600">Carregando...</div>}
        {cases.isError && <div className="text-sm text-rose-700">Falha ao carregar ocorrências</div>}
        {cases.data && cases.data.length === 0 && <div className="text-sm text-slate-600">Nenhuma ocorrência</div>}
        {cases.data && cases.data.length > 0 && (
          <div className="overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Prioridade</th>
                  <th className="py-2 pr-3 font-medium">Unidade</th>
                  <th className="py-2 pr-3 font-medium">Atualizado</th>
                  <th className="py-2 pr-3 font-medium">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cases.data.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2 pr-3">{feedbackCaseStatusLabel(c.status)}</td>
                    <td className="py-2 pr-3">{feedbackCasePriorityLabel(c.priority)}</td>
                    <td className="py-2 pr-3">{c.unit?.name ?? '—'}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{formatDateTime(c.updatedAt)}</td>
                    <td className="py-2 pr-3">
                      <Link to={`/app/feedbacks/${c.surveyResponse.id}`} className="text-sky-700 hover:underline">
                        Abrir
                      </Link>
                    </td>
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
