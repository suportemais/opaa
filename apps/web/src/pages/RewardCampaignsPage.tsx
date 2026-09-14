import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { couponCampaignStatusClass, couponCampaignStatusLabel } from '../lib/labels';

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

type TenantMe = {
  id: string;
  tradeName?: string;
  legalName?: string;
  settings?: { mmCompanyId?: string };
};

type MmCompanyOption = { id: string; label: string };

const DEFAULT_WHATSAPP = 'Seu prêmio de R$ {{amount}}:\n{{code}}\nResgate: {{link}}';
const WHATSAPP_TOKENS = ['{{code}}', '{{link}}', '{{amount}}'] as const;

const FIELD_CLASS =
  'h-12 w-full rounded-full border border-opiina-border bg-white px-4 text-sm text-opiina-navy shadow-none outline-none placeholder:text-slate-400 focus:border-opiina-cyan focus:ring-2 focus:ring-sky-100';

function reaisFromCents(cents: number | null | undefined) {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return '';
  return (cents / 100).toFixed(2).replace('.', ',');
}

function formatBRL(cents: number | null | undefined) {
  const raw = reaisFromCents(cents);
  return raw ? `R$ ${raw}` : '—';
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

function looksLikeRawId(value: string | null | undefined) {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}

function tenantCompanyLabel(tenant: TenantMe | undefined) {
  const name = tenant?.tradeName?.trim() || tenant?.legalName?.trim();
  if (name && !looksLikeRawId(name)) return `${name} — MM`;
  return 'Empresa Muito Mais';
}

function buildMmCompanyOptions(
  tenant: TenantMe | undefined,
  campaigns: RewardCampaign[],
  preferredId?: string | null,
): MmCompanyOption[] {
  const label = tenantCompanyLabel(tenant);
  const id =
    preferredId?.trim() ||
    tenant?.settings?.mmCompanyId?.trim() ||
    campaigns.find((row) => row.mmCompanyId?.trim())?.mmCompanyId?.trim() ||
    tenant?.id?.trim();
  if (!id) return [];
  return [{ id, label }];
}

function StatusChip({ status }: { status: string }) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium',
        couponCampaignStatusClass(status),
      ].join(' ')}
    >
      {couponCampaignStatusLabel(status)}
    </span>
  );
}

export function RewardCampaignsPage() {
  const qc = useQueryClient();
  const surveys = useQuery({ queryKey: ['surveys'], queryFn: () => apiFetch<Survey[]>('/surveys') });
  const campaigns = useQuery({
    queryKey: ['coupon-campaigns'],
    queryFn: () => apiFetch<RewardCampaign[]>('/coupon-campaigns'),
  });
  const tenant = useQuery({
    queryKey: ['tenantMe'],
    queryFn: () => apiFetch<TenantMe>('/tenant/me').catch(() => ({ id: '' })),
    staleTime: 60 * 1000,
  });

  const [mode, setMode] = useState<'list' | 'form'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [surveyId, setSurveyId] = useState('');
  const [mmCompanyId, setMmCompanyId] = useState('');
  const [amountReais, setAmountReais] = useState('10,00');
  const [validityDays, setValidityDays] = useState('30');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [message, setMessage] = useState(DEFAULT_WHATSAPP);
  const [formError, setFormError] = useState<string | null>(null);

  const companyOptions = useMemo(() => {
    const editingRow = (campaigns.data ?? []).find((row) => row.id === editingId);
    return buildMmCompanyOptions(tenant.data, campaigns.data ?? [], editingRow?.mmCompanyId);
  }, [tenant.data, campaigns.data, editingId]);

  const defaultSurveyId = useMemo(() => surveys.data?.[0]?.id ?? '', [surveys.data]);
  const defaultCompanyId = companyOptions[0]?.id ?? '';

  useEffect(() => {
    if (!surveyId && defaultSurveyId) setSurveyId(defaultSurveyId);
  }, [defaultSurveyId, surveyId]);

  useEffect(() => {
    if (!mmCompanyId && defaultCompanyId) setMmCompanyId(defaultCompanyId);
  }, [defaultCompanyId, mmCompanyId]);

  function resetForm() {
    setEditingId(null);
    setName('');
    setSurveyId(defaultSurveyId);
    setMmCompanyId(defaultCompanyId);
    setAmountReais('10,00');
    setValidityDays('30');
    setStartsAt('');
    setEndsAt('');
    setMessage(DEFAULT_WHATSAPP);
    setFormError(null);
  }

  function openCreate() {
    resetForm();
    setMode('form');
  }

  function openEdit(row: RewardCampaign) {
    setEditingId(row.id);
    setName(row.name);
    setSurveyId(row.surveyId ?? defaultSurveyId);
    setMmCompanyId(row.mmCompanyId ?? defaultCompanyId);
    setAmountReais(reaisFromCents(row.rewardAmountCents) || '10,00');
    setValidityDays(row.validityDays ? String(row.validityDays) : '');
    setStartsAt(toDateTimeLocal(row.startsAt));
    setEndsAt(toDateTimeLocal(row.endsAt));
    setMessage(row.message || DEFAULT_WHATSAPP);
    setFormError(null);
    setMode('form');
  }

  function backToList() {
    resetForm();
    setMode('list');
  }

  function payload() {
    const rewardAmountCents = centsFromReais(amountReais);
    if (!name.trim()) throw new Error('Informe o nome da campanha.');
    if (!surveyId) throw new Error('Selecione a pesquisa elegível.');
    if (!mmCompanyId.trim()) throw new Error('Selecione a empresa Muito Mais.');
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
      backToList();
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

  function insertToken(token: string) {
    setMessage((prev) => (prev.includes(token) ? prev : `${prev.trim()}\n${token}`.trim()));
  }

  const rows = campaigns.data ?? [];

  if (mode === 'form') {
    return (
      <CampaignForm
        editing={Boolean(editingId)}
        name={name}
        setName={setName}
        surveyId={surveyId}
        setSurveyId={setSurveyId}
        surveys={surveys.data ?? []}
        mmCompanyId={mmCompanyId}
        setMmCompanyId={setMmCompanyId}
        companyOptions={companyOptions}
        amountReais={amountReais}
        setAmountReais={setAmountReais}
        validityDays={validityDays}
        setValidityDays={setValidityDays}
        startsAt={startsAt}
        setStartsAt={setStartsAt}
        endsAt={endsAt}
        setEndsAt={setEndsAt}
        message={message}
        setMessage={setMessage}
        formError={formError}
        pending={save.isPending}
        onBack={backToList}
        onInsertToken={insertToken}
        onSubmit={() => {
          try {
            setFormError(null);
            payload();
            save.mutate();
          } catch (err) {
            setFormError(err instanceof Error ? err.message : 'Dados inválidos');
          }
        }}
      />
    );
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-3xl font-semibold tracking-tight text-opiina-navy">Prêmios</h1>
            <span className="inline-flex items-center rounded-full bg-[#E8F4FF] px-3 py-1 text-xs font-medium text-opiina-cyan">
              Prêmios Muito Mais
            </span>
          </div>
          <p className="mt-2 text-sm text-opiina-muted">Campanhas de recompensa vinculadas às pesquisas.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-11 items-center justify-center rounded-full bg-opiina-navy px-5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Nova campanha
        </button>
      </div>

      {campaigns.isLoading ? (
        <div className="text-sm text-opiina-muted">Carregando...</div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-opiina-border bg-white px-5 py-8 text-sm text-opiina-muted">
          Sem campanhas? Crie a primeira em &quot;Nova campanha&quot;.
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:hidden">
            {rows.map((row) => (
              <CampaignCard
                key={row.id}
                row={row}
                onEdit={() => openEdit(row)}
                onPause={() => pause.mutate(row.id)}
                onActivate={() => activate.mutate(row.id)}
                pausePending={pause.isPending}
                activatePending={activate.isPending}
              />
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-opiina-border bg-white md:block">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-opiina-border text-opiina-muted">
                  <th className="px-5 py-3.5 font-medium">Nome</th>
                  <th className="px-5 py-3.5 font-medium">Pesquisa</th>
                  <th className="px-5 py-3.5 font-medium">Valor</th>
                  <th className="px-5 py-3.5 font-medium">Status</th>
                  <th className="px-5 py-3.5 font-medium">Emitidos</th>
                  <th className="px-5 py-3.5 font-medium">Resgatados</th>
                  <th className="px-5 py-3.5 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-opiina-border">
                    <td className="px-5 py-4 font-medium text-opiina-navy">{row.name}</td>
                    <td className="px-5 py-4 text-opiina-navy">{row.surveyName ?? '—'}</td>
                    <td className="px-5 py-4 text-opiina-navy">{formatBRL(row.rewardAmountCents)}</td>
                    <td className="px-5 py-4">
                      <StatusChip status={row.status} />
                    </td>
                    <td className="px-5 py-4 text-opiina-navy">{row.issuedCount}</td>
                    <td className="px-5 py-4 text-opiina-navy">{row.redeemedCount}</td>
                    <td className="px-5 py-4">
                      <CampaignActions
                        row={row}
                        layout="inline"
                        onEdit={() => openEdit(row)}
                        onPause={() => pause.mutate(row.id)}
                        onActivate={() => activate.mutate(row.id)}
                        pausePending={pause.isPending}
                        activatePending={activate.isPending}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function CampaignCard(props: {
  row: RewardCampaign;
  onEdit: () => void;
  onPause: () => void;
  onActivate: () => void;
  pausePending: boolean;
  activatePending: boolean;
}) {
  const { row } = props;
  return (
    <article className="rounded-2xl border border-opiina-border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold text-opiina-navy">{row.name}</h2>
        <StatusChip status={row.status} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div>
          <dt className="text-opiina-muted">Pesquisa</dt>
          <dd className="mt-0.5 font-medium text-opiina-navy">{row.surveyName ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-opiina-muted">Valor</dt>
          <dd className="mt-0.5 font-medium text-opiina-navy">{formatBRL(row.rewardAmountCents)}</dd>
        </div>
        <div>
          <dt className="text-opiina-muted">Emitidos</dt>
          <dd className="mt-0.5 font-medium text-opiina-navy">{row.issuedCount}</dd>
        </div>
        <div>
          <dt className="text-opiina-muted">Resgatados</dt>
          <dd className="mt-0.5 font-medium text-opiina-navy">{row.redeemedCount}</dd>
        </div>
      </dl>
      <div className="mt-5">
        <CampaignActions {...props} layout="card" />
      </div>
    </article>
  );
}

function CampaignActions(props: {
  row: RewardCampaign;
  layout: 'card' | 'inline';
  onEdit: () => void;
  onPause: () => void;
  onActivate: () => void;
  pausePending: boolean;
  activatePending: boolean;
}) {
  const finished = props.row.status === 'finished';
  const active = props.row.status === 'active';
  const pill =
    'inline-flex h-9 items-center justify-center rounded-full border border-opiina-border bg-white px-4 text-sm font-medium text-opiina-navy hover:bg-slate-50 disabled:opacity-50';
  const link = 'text-sm font-medium text-opiina-cta hover:underline disabled:opacity-50';
  const muted = 'text-sm font-medium text-opiina-navy hover:underline disabled:opacity-50';

  return (
    <div className={props.layout === 'card' ? 'flex items-center justify-between gap-3' : 'flex flex-wrap items-center gap-4'}>
      <button type="button" className={link} onClick={props.onEdit}>
        Editar
      </button>
      {!finished &&
        (active ? (
          <button type="button" className={props.layout === 'card' ? pill : muted} disabled={props.pausePending} onClick={props.onPause}>
            Pausar
          </button>
        ) : (
          <button type="button" className={props.layout === 'card' ? pill : muted} disabled={props.activatePending} onClick={props.onActivate}>
            Ativar
          </button>
        ))}
    </div>
  );
}

function FieldLabel({ children }: { children: string }) {
  return <div className="mb-1.5 text-sm font-medium text-opiina-navy">{children}</div>;
}

function CampaignForm(props: {
  editing: boolean;
  name: string;
  setName: (v: string) => void;
  surveyId: string;
  setSurveyId: (v: string) => void;
  surveys: Survey[];
  mmCompanyId: string;
  setMmCompanyId: (v: string) => void;
  companyOptions: MmCompanyOption[];
  amountReais: string;
  setAmountReais: (v: string) => void;
  validityDays: string;
  setValidityDays: (v: string) => void;
  startsAt: string;
  setStartsAt: (v: string) => void;
  endsAt: string;
  setEndsAt: (v: string) => void;
  message: string;
  setMessage: (v: string) => void;
  formError: string | null;
  pending: boolean;
  onBack: () => void;
  onInsertToken: (token: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-xl">
      <button type="button" onClick={props.onBack} className="text-sm font-medium text-opiina-cta hover:underline">
        ← Voltar à lista
      </button>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-opiina-navy">
        {props.editing ? 'Editar campanha' : 'Nova campanha'}
      </h1>
      <p className="mt-2 text-sm text-opiina-muted">
        {props.editing ? 'Atualize e salve a campanha de prêmio.' : 'Crie e ative uma campanha de prêmio.'}
      </p>

      <div className="mt-6 grid gap-4">
        <label>
          <FieldLabel>Nome</FieldLabel>
          <input
            value={props.name}
            onChange={(e) => props.setName(e.target.value)}
            placeholder="NPS Setembro — R$10"
            className={FIELD_CLASS}
          />
        </label>
        <label>
          <FieldLabel>Pesquisa</FieldLabel>
          <select className={FIELD_CLASS} value={props.surveyId} onChange={(e) => props.setSurveyId(e.target.value)}>
            <option value="">Selecione</option>
            {props.surveys.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <FieldLabel>Empresa Muito Mais</FieldLabel>
          <select
            className={FIELD_CLASS}
            value={props.mmCompanyId}
            onChange={(e) => props.setMmCompanyId(e.target.value)}
          >
            <option value="">Selecione a empresa</option>
            {props.companyOptions.map((company) => (
              <option key={company.id} value={company.id}>
                {company.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <FieldLabel>Valor R$ (fixo)</FieldLabel>
          <input
            value={props.amountReais}
            onChange={(e) => props.setAmountReais(e.target.value)}
            placeholder="10,00"
            inputMode="decimal"
            className={FIELD_CLASS}
          />
        </label>
        <label>
          <FieldLabel>Validade (dias)</FieldLabel>
          <input
            value={props.validityDays}
            onChange={(e) => props.setValidityDays(e.target.value)}
            placeholder="30"
            inputMode="numeric"
            className={FIELD_CLASS}
          />
        </label>
        <label>
          <FieldLabel>Início</FieldLabel>
          <input
            type="datetime-local"
            value={props.startsAt}
            onChange={(e) => props.setStartsAt(e.target.value)}
            className={FIELD_CLASS}
          />
        </label>
        <label>
          <FieldLabel>Fim</FieldLabel>
          <input
            type="datetime-local"
            value={props.endsAt}
            onChange={(e) => props.setEndsAt(e.target.value)}
            className={FIELD_CLASS}
          />
        </label>
        <label>
          <FieldLabel>Texto WhatsApp</FieldLabel>
          <textarea
            className="min-h-28 w-full resize-none rounded-2xl border border-opiina-border bg-white p-4 text-sm text-opiina-navy outline-none placeholder:text-slate-400 focus:border-opiina-cyan focus:ring-2 focus:ring-sky-100"
            value={props.message}
            onChange={(e) => props.setMessage(e.target.value)}
            placeholder={DEFAULT_WHATSAPP}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-opiina-muted">Placeholders:</span>
            {WHATSAPP_TOKENS.map((token) => (
              <button
                key={token}
                type="button"
                onClick={() => props.onInsertToken(token)}
                className="rounded-full bg-[#E8F4FF] px-2.5 py-0.5 font-mono text-xs text-opiina-cyan"
              >
                {token}
              </button>
            ))}
          </div>
        </label>

        <div className="rounded-2xl bg-[#EFF6FF] px-4 py-3 text-sm text-opiina-navy">
          Limite por cliente: 1 (fixo — não editável)
        </div>

        {props.formError && (
          <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{props.formError}</div>
        )}

        <button
          type="button"
          onClick={props.onSubmit}
          disabled={props.pending}
          className="inline-flex h-12 w-full items-center justify-center rounded-full bg-opiina-cta text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {props.pending ? 'Salvando...' : props.editing ? 'Salvar' : 'Criar e ativar'}
        </button>
      </div>
    </div>
  );
}
