import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { couponCampaignStatusLabel } from '../lib/labels';

type Survey = { id: string; name: string; status: string };
type RewardCampaign = {
  id: string;
  name: string;
  surveyId: string | null;
  surveyName: string | null;
  mmCompanyId: string | null;
  rewardAmountCents: number | null;
  validityDays: number | null;
  startsAt: string | null;
  endsAt: string | null;
  message: string | null;
  prefix: string | null;
  status: string;
  perCustomerLimit: number;
  issuedCount: number;
  redeemedCount: number;
};

const DEFAULT_WHATSAPP =
  'Você ganhou {{amount}} no Muito Mais. Código: {{code}}. Resgate: {{link}}';

function reaisFromCents(cents: number | null | undefined) {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return '';
  return (cents / 100).toFixed(2).replace('.', ',');
}

function centsFromReais(raw: string) {
  const trimmed = raw.trim().replace(/[R$\s]/g, '');
  if (!trimmed) return null;
  const normalized = trimmed.includes(',') ? trimmed.replace(/\./g, '').replace(',', '.') : trimmed;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDateTimeLocal(value: string) {
  if (!value.trim()) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

export function RewardCampaignsPage() {
  const qc = useQueryClient();
  const surveys = useQuery({ queryKey: ['surveys'], queryFn: () => apiFetch<Survey[]>('/surveys') });
  const campaigns = useQuery({
    queryKey: ['coupon-campaigns'],
    queryFn: () => apiFetch<RewardCampaign[]>('/coupon-campaigns'),
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('Prêmio pós-pesquisa');
  const [surveyId, setSurveyId] = useState('');
  const [mmCompanyId, setMmCompanyId] = useState('');
  const [amountReais, setAmountReais] = useState('15,00');
  const [validityDays, setValidityDays] = useState('30');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [message, setMessage] = useState(DEFAULT_WHATSAPP);
  const [formError, setFormError] = useState<string | null>(null);

  const defaultSurveyId = useMemo(() => surveys.data?.[0]?.id ?? '', [surveys.data]);
  useEffect(() => {
    if (!surveyId && defaultSurveyId) setSurveyId(defaultSurveyId);
  }, [defaultSurveyId, surveyId]);

  function resetForm() {
    setEditingId(null);
    setName('Prêmio pós-pesquisa');
    setSurveyId(defaultSurveyId);
    setMmCompanyId('');
    setAmountReais('15,00');
    setValidityDays('30');
    setStartsAt('');
    setEndsAt('');
    setMessage(DEFAULT_WHATSAPP);
    setFormError(null);
  }

  function loadCampaign(row: RewardCampaign) {
    setEditingId(row.id);
    setName(row.name);
    setSurveyId(row.surveyId ?? defaultSurveyId);
    setMmCompanyId(row.mmCompanyId ?? '');
    setAmountReais(reaisFromCents(row.rewardAmountCents) || '15,00');
    setValidityDays(row.validityDays ? String(row.validityDays) : '');
    setStartsAt(toDateTimeLocal(row.startsAt));
    setEndsAt(toDateTimeLocal(row.endsAt));
    setMessage(row.message || DEFAULT_WHATSAPP);
    setFormError(null);
  }

  function payload() {
    const rewardAmountCents = centsFromReais(amountReais);
    if (!name.trim()) throw new Error('Informe o nome da campanha.');
    if (!surveyId) throw new Error('Selecione a pesquisa elegível.');
    if (!mmCompanyId.trim()) throw new Error('mmCompanyId é obrigatório.');
    if (!rewardAmountCents) throw new Error('Informe um valor em R$ maior que zero.');
    const days = validityDays.trim() ? Number(validityDays) : undefined;
    if (days != null && (!Number.isInteger(days) || days < 1)) throw new Error('Validade deve ser um número de dias.');
    return {
      name: name.trim(),
      surveyId,
      mmCompanyId: mmCompanyId.trim(),
      rewardAmountCents,
      validityDays: days,
      startsAt: fromDateTimeLocal(startsAt),
      endsAt: fromDateTimeLocal(endsAt),
      message: message.trim() || undefined,
      prefix: 'MM',
    };
  }

  const save = useMutation({
    mutationFn: async () => {
      const body = payload();
      if (editingId) {
        return apiFetch<RewardCampaign>(`/coupon-campaigns/${editingId}`, { method: 'PATCH', json: body });
      }
      return apiFetch<RewardCampaign>('/coupon-campaigns', { method: 'POST', json: { ...body, activate: true } });
    },
    onSuccess: async () => {
      resetForm();
      await qc.invalidateQueries({ queryKey: ['coupon-campaigns'] });
    },
    onError: (err) => {
      setFormError(err instanceof Error ? err.message : 'Falha ao salvar a campanha.');
    },
  });

  const pause = useMutation({
    mutationFn: (id: string) => apiFetch<RewardCampaign>(`/coupon-campaigns/${id}/pause`, { method: 'POST' }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['coupon-campaigns'] });
    },
  });

  const activate = useMutation({
    mutationFn: (id: string) => apiFetch<RewardCampaign>(`/coupon-campaigns/${id}/activate`, { method: 'POST' }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['coupon-campaigns'] });
    },
  });

  return (
    <div className="grid gap-6">
      <div>
        <div className="text-xl font-semibold">Prêmios Muito Mais</div>
        <div className="text-sm text-slate-600">
          Uma campanha emite 1 código por cliente após a pesquisa. Pause para interromper; não há exclusão.
        </div>
      </div>

      <Card
        title={editingId ? 'Editar campanha' : 'Nova campanha'}
        description="Valor fixo em R$, empresa MM e texto do WhatsApp. Limite por cliente = 1."
      >
        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <div className="mb-1 text-sm font-medium text-slate-700">Nome</div>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Prêmio pós-pesquisa" />
          </div>
          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">Pesquisa</div>
            <select
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              value={surveyId}
              onChange={(e) => setSurveyId(e.target.value)}
            >
              <option value="">Selecione</option>
              {(surveys.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">mmCompanyId</div>
            <Input value={mmCompanyId} onChange={(e) => setMmCompanyId(e.target.value)} placeholder="ID da empresa no Muito Mais" />
          </div>
          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">Valor (R$)</div>
            <Input value={amountReais} onChange={(e) => setAmountReais(e.target.value)} placeholder="15,00" inputMode="decimal" />
          </div>
          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">Validade (dias)</div>
            <Input value={validityDays} onChange={(e) => setValidityDays(e.target.value)} placeholder="30" inputMode="numeric" />
          </div>
          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">Início</div>
            <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </div>
          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">Fim</div>
            <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <div className="mb-1 text-sm font-medium text-slate-700">Texto WhatsApp</div>
            <textarea
              className="min-h-24 w-full resize-none rounded-md border border-slate-200 bg-white p-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={DEFAULT_WHATSAPP}
            />
            <div className="mt-1 text-xs text-slate-500">Placeholders: {'{{code}}'}, {'{{link}}'}, {'{{amount}}'}</div>
          </div>
          {formError && (
            <div className="md:col-span-2 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</div>
          )}
          <div className="md:col-span-2 flex items-center justify-end gap-2">
            {editingId && (
              <Button variant="secondary" onClick={resetForm} disabled={save.isPending}>
                Cancelar
              </Button>
            )}
            <Button
              onClick={() => {
                try {
                  setFormError(null);
                  payload();
                  save.mutate();
                } catch (err) {
                  setFormError(err instanceof Error ? err.message : 'Dados inválidos');
                }
              }}
              disabled={save.isPending}
            >
              {save.isPending ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Criar e ativar'}
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Campanhas" description="Emitidos e resgatados são somente leitura.">
        {campaigns.isLoading ? (
          <div className="text-sm text-slate-500">Carregando...</div>
        ) : (campaigns.data ?? []).length === 0 ? (
          <div className="text-sm text-slate-500">Nenhuma campanha ainda.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="pb-2 pr-4 font-medium">Nome</th>
                  <th className="pb-2 pr-4 font-medium">Pesquisa</th>
                  <th className="pb-2 pr-4 font-medium">Valor</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Emitidos</th>
                  <th className="pb-2 pr-4 font-medium">Resgatados</th>
                  <th className="pb-2 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {(campaigns.data ?? []).map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="py-3 pr-4 font-medium text-slate-900">{row.name}</td>
                    <td className="py-3 pr-4 text-slate-600">{row.surveyName ?? '—'}</td>
                    <td className="py-3 pr-4 text-slate-700">
                      {typeof row.rewardAmountCents === 'number' ? `R$ ${reaisFromCents(row.rewardAmountCents)}` : '—'}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={[
                          'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                          row.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700'
                            : row.status === 'paused'
                              ? 'bg-amber-50 text-amber-800'
                              : 'bg-slate-100 text-slate-600',
                        ].join(' ')}
                      >
                        {couponCampaignStatusLabel(row.status)}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-slate-700">{row.issuedCount}</td>
                    <td className="py-3 pr-4 text-slate-700">{row.redeemedCount}</td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" onClick={() => loadCampaign(row)}>
                          Editar
                        </Button>
                        {row.status === 'active' ? (
                          <Button
                            variant="secondary"
                            disabled={pause.isPending}
                            onClick={() => pause.mutate(row.id)}
                          >
                            Pausar
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            disabled={activate.isPending}
                            onClick={() => activate.mutate(row.id)}
                          >
                            Ativar
                          </Button>
                        )}
                      </div>
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
