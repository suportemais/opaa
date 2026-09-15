import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { BrandMark } from '../components/BrandMark';
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

/** Muito Mais Company.id + Company.tradeName — never an establishment. */
type MmCompany = { id: string; tradeName: string };
type MmCompanyOption = { id: string; label: string };

const DEFAULT_WHATSAPP = 'Seu prêmio de R$ {{amount}}:\n{{code}}\nResgate: {{link}}';
const WHATSAPP_TOKENS = ['{{code}}', '{{link}}', '{{amount}}'] as const;

const DESIGN_PREVIEW_SURVEYS: Survey[] = [
  { id: 's1', name: 'NPS pós-visita', status: 'active' },
  { id: 's2', name: 'CSAT delivery', status: 'active' },
  { id: 's3', name: 'NPS unidade Centro', status: 'active' },
];

const DESIGN_PREVIEW_COMPANIES: MmCompany[] = [
  { id: 'mm-company-gepos', tradeName: 'Grupo Geppos' },
];

const DESIGN_PREVIEW_CAMPAIGNS: RewardCampaign[] = [
  {
    id: 'c1',
    name: 'NPS Setembro — R$10',
    surveyId: 's1',
    surveyName: 'NPS pós-visita',
    mmCompanyId: 'mm-company-gepos',
    rewardAmountCents: 1000,
    validityDays: 30,
    startsAt: '2026-09-15T12:00:00.000Z',
    endsAt: '2026-10-15T23:59:00.000Z',
    message: DEFAULT_WHATSAPP,
    prefix: 'MM',
    status: 'active',
    perCustomerLimit: 1,
    issuedCount: 128,
    redeemedCount: 47,
  },
  {
    id: 'c2',
    name: 'CSAT delivery — R$20',
    surveyId: 's2',
    surveyName: 'CSAT delivery',
    mmCompanyId: 'mm-company-gepos',
    rewardAmountCents: 2000,
    validityDays: 30,
    startsAt: null,
    endsAt: null,
    message: DEFAULT_WHATSAPP,
    prefix: 'MM',
    status: 'paused',
    perCustomerLimit: 1,
    issuedCount: 56,
    redeemedCount: 12,
  },
  {
    id: 'c3',
    name: 'Campanha piloto — R$10',
    surveyId: 's3',
    surveyName: 'NPS unidade Centro',
    mmCompanyId: 'mm-company-gepos',
    rewardAmountCents: 1000,
    validityDays: 30,
    startsAt: null,
    endsAt: null,
    message: DEFAULT_WHATSAPP,
    prefix: 'MM',
    status: 'finished',
    perCustomerLimit: 1,
    issuedCount: 210,
    redeemedCount: 98,
  },
];

function isDesignPreview() {
  if (!import.meta.env.DEV) return false;
  if (typeof window === 'undefined') return false;
  if (window.location.pathname.startsWith('/premios-preview')) return true;
  return new URLSearchParams(window.location.search).get('preview') === '1';
}

/** Isolated chrome only on the DEV `/premios-preview` route. `/app/premios` always uses AppShell. */
function isIsolatedPreviewRoute() {
  if (!import.meta.env.DEV) return false;
  if (typeof window === 'undefined') return false;
  return window.location.pathname.startsWith('/premios-preview');
}

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

/** Operator label = MM Company.tradeName. Never tenant/unit/establishment names. */
function buildMmCompanyOptions(
  companies: MmCompany[],
  selectedId?: string | null,
): MmCompanyOption[] {
  const options = companies
    .filter((row) => row.id.trim() && row.tradeName.trim())
    .map((row) => ({ id: row.id.trim(), label: `${row.tradeName.trim()} — MM` }));
  const selected = selectedId?.trim();
  if (selected && !options.some((row) => row.id === selected)) {
    options.push({ id: selected, label: 'Empresa Muito Mais' });
  }
  return options;
}

/** Isolated chrome for the DEV-only `/premios-preview` route. Production `/app/premios` uses AppShell. */
function PremiosPreviewChrome(props: { action?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-full bg-opiina-bg text-opiina-navy">
      <header className="bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-5 py-3">
          <Link to="/app" className="min-w-0">
            <BrandMark />
          </Link>
          {props.action}
        </div>
        <div className="h-0.5 bg-gradient-to-r from-opiina-cyan to-opiina-violet" />
      </header>
      <main className="mx-auto w-full max-w-5xl px-5 py-8">{props.children}</main>
    </div>
  );
}

function PageFrame(props: { preview: boolean; action?: ReactNode; children: ReactNode }) {
  if (props.preview) {
    return <PremiosPreviewChrome action={props.action}>{props.children}</PremiosPreviewChrome>;
  }
  return <>{props.children}</>;
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
  const preview = isDesignPreview();
  const isolated = isIsolatedPreviewRoute();
  const surveys = useQuery({
    queryKey: ['surveys'],
    queryFn: () => apiFetch<Survey[]>('/surveys'),
    enabled: !preview,
  });
  const campaigns = useQuery({
    queryKey: ['coupon-campaigns'],
    queryFn: () => apiFetch<RewardCampaign[]>('/coupon-campaigns'),
    enabled: !preview,
  });
  const mmCompanies = useQuery({
    queryKey: ['mm-companies'],
    queryFn: () => apiFetch<MmCompany[]>('/mm-companies'),
    staleTime: 60 * 1000,
    enabled: !preview,
  });
  const surveyRows = useMemo(
    () => (preview ? DESIGN_PREVIEW_SURVEYS : (surveys.data ?? [])),
    [preview, surveys.data],
  );
  const campaignRows = useMemo(
    () => (preview ? DESIGN_PREVIEW_CAMPAIGNS : (campaigns.data ?? [])),
    [preview, campaigns.data],
  );
  const companyRows = useMemo(
    () => (preview ? DESIGN_PREVIEW_COMPANIES : (mmCompanies.data ?? [])),
    [preview, mmCompanies.data],
  );

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
    const editingRow = campaignRows.find((row) => row.id === editingId);
    return buildMmCompanyOptions(companyRows, editingRow?.mmCompanyId ?? mmCompanyId);
  }, [companyRows, campaignRows, editingId, mmCompanyId]);

  const defaultSurveyId = useMemo(() => surveyRows[0]?.id ?? '', [surveyRows]);
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
    if (days != null && (!Number.isInteger(days) || days < 1))
      throw new Error('Validade deve ser um número de dias.');
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
        return apiFetch<RewardCampaign>(`/coupon-campaigns/${editingId}`, {
          method: 'PATCH',
          json: body,
        });
      }
      return apiFetch<RewardCampaign>('/coupon-campaigns', {
        method: 'POST',
        json: { ...body, activate: true },
      });
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
    mutationFn: (id: string) =>
      apiFetch<RewardCampaign>(`/coupon-campaigns/${id}/pause`, { method: 'POST' }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['coupon-campaigns'] });
    },
  });

  const activate = useMutation({
    mutationFn: (id: string) =>
      apiFetch<RewardCampaign>(`/coupon-campaigns/${id}/activate`, { method: 'POST' }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['coupon-campaigns'] });
    },
  });

  function insertToken(token: string) {
    setMessage((prev) => (prev.includes(token) ? prev : `${prev.trim()}\n${token}`.trim()));
  }

  const rows = campaignRows;
  const listLoading = preview ? false : campaigns.isLoading;

  const novaCampanha = (
    <button
      type="button"
      onClick={openCreate}
      className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-opiina-navy px-5 text-sm font-medium text-white hover:bg-slate-800"
    >
      Nova campanha
    </button>
  );

  if (mode === 'form') {
    return (
      <PageFrame preview={isolated}>
        <CampaignForm
          editing={Boolean(editingId)}
          name={name}
          setName={setName}
          surveyId={surveyId}
          setSurveyId={setSurveyId}
          surveys={surveyRows}
          mmCompanyId={mmCompanyId}
          setMmCompanyId={setMmCompanyId}
          companyOptions={companyOptions}
          companiesLoading={preview ? false : mmCompanies.isLoading}
          companiesError={preview ? false : mmCompanies.isError}
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
      </PageFrame>
    );
  }

  return (
    <PageFrame preview={isolated} action={isolated ? novaCampanha : undefined}>
      <div className="grid gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-3xl font-semibold tracking-tight text-opiina-navy">Prêmios</h1>
              <span className="inline-flex items-center rounded-full bg-[#E8F4FF] px-3 py-1 text-xs font-medium text-opiina-cyan">
                Prêmios Muito Mais
              </span>
            </div>
            <p className="mt-2 text-sm text-opiina-muted md:hidden">
              Campanhas de recompensa vinculadas às pesquisas.
            </p>
          </div>
          {!isolated && novaCampanha}
        </div>

        {listLoading ? (
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
                      <td className="px-5 py-4 text-opiina-navy">
                        {formatBRL(row.rewardAmountCents)}
                      </td>
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

            <p className="text-sm text-opiina-muted md:hidden">
              Sem campanhas? Crie a primeira em &quot;Nova campanha&quot;.
            </p>
          </>
        )}
      </div>
    </PageFrame>
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
          <dd className="mt-0.5 font-medium text-opiina-navy">
            {formatBRL(row.rewardAmountCents)}
          </dd>
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
  const link =
    props.layout === 'card'
      ? 'text-sm font-medium text-opiina-navy hover:underline disabled:opacity-50'
      : 'text-sm font-medium text-opiina-cta hover:underline disabled:opacity-50';
  const muted = 'text-sm font-medium text-opiina-navy hover:underline disabled:opacity-50';

  return (
    <div
      className={
        props.layout === 'card'
          ? 'flex items-center justify-between gap-3'
          : 'flex flex-wrap items-center gap-4'
      }
    >
      <button type="button" className={link} onClick={props.onEdit}>
        Editar
      </button>
      {!finished &&
        (active ? (
          <button
            type="button"
            className={props.layout === 'card' ? pill : muted}
            disabled={props.pausePending}
            onClick={props.onPause}
          >
            Pausar
          </button>
        ) : (
          <button
            type="button"
            className={props.layout === 'card' ? pill : muted}
            disabled={props.activatePending}
            onClick={props.onActivate}
          >
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
  companiesLoading: boolean;
  companiesError: boolean;
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
      <button
        type="button"
        onClick={props.onBack}
        className="text-sm font-medium text-opiina-navy hover:underline"
      >
        ← Voltar à lista
      </button>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-opiina-navy">
        {props.editing ? 'Editar campanha' : 'Nova campanha'}
      </h1>
      <p className="mt-2 text-sm text-opiina-muted">
        {props.editing
          ? 'Atualize e salve a campanha de prêmio.'
          : 'Crie e ative uma campanha de prêmio.'}
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
          <select
            className={FIELD_CLASS}
            value={props.surveyId}
            onChange={(e) => props.setSurveyId(e.target.value)}
          >
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
            disabled={props.companiesLoading}
          >
            <option value="">
              {props.companiesLoading ? 'Carregando empresas...' : 'Selecione a empresa'}
            </option>
            {props.companyOptions.map((company) => (
              <option key={company.id} value={company.id}>
                {company.label}
              </option>
            ))}
          </select>
          <div className="mt-1.5 text-xs text-opiina-muted">
            Nome fantasia da empresa no Muito Mais (Company.id). Estabelecimentos não entram nesta
            lista.
          </div>
          {props.companiesError && (
            <div className="mt-1.5 text-xs text-rose-700">
              Não foi possível carregar as empresas do Muito Mais.
            </div>
          )}
          {!props.companiesLoading &&
            !props.companiesError &&
            props.companyOptions.length === 0 && (
              <div className="mt-1.5 text-xs text-opiina-muted">
                Nenhuma empresa do Muito Mais disponível.
              </div>
            )}
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
            className="min-h-[3rem] w-full resize-none rounded-[28px] border border-opiina-border bg-white px-4 py-3 text-sm text-opiina-navy outline-none placeholder:text-slate-400 focus:border-opiina-cyan focus:ring-2 focus:ring-sky-100"
            value={props.message}
            onChange={(e) => props.setMessage(e.target.value)}
            placeholder={DEFAULT_WHATSAPP}
            rows={3}
          />
          <div className="mt-2 text-xs text-opiina-muted">
            Placeholders:{' '}
            {WHATSAPP_TOKENS.map((token, i) => (
              <button
                key={token}
                type="button"
                onClick={() => props.onInsertToken(token)}
                className="font-mono text-opiina-cyan hover:underline"
              >
                {i > 0 ? ' ' : ''}
                {token}
              </button>
            ))}
          </div>
        </label>

        <div className="rounded-2xl bg-[#EFF6FF] px-4 py-3 text-sm text-opiina-navy">
          Limite por cliente: 1 (fixo — não editável)
        </div>

        {props.formError && (
          <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {props.formError}
          </div>
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
