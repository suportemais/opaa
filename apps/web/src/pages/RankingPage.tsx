import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

type Unit = { id: string; name: string };

type SentimentMix = {
  elogio: number;
  reclamacao: number;
  neutro: number;
  classified: number;
  percents: { elogio: number; reclamacao: number; neutro: number };
};

type TreatmentStats = {
  detractors: number;
  withCase: number;
  withoutCase: number;
  caseOpen: number;
  caseClosed: number;
  caseOverdue: number;
  caseUnassigned: number;
  withCasePct: number | null;
  resolvedOfCasesPct: number | null;
  resolvedOfDetractorsPct: number | null;
  onTimePct: number | null;
  avgHoursToFirstAction: number | null;
  medianHoursToFirstAction: number | null;
  avgHoursToClose: number | null;
  medianHoursToClose: number | null;
};

type RankingUnitSnapshot = {
  rank: number;
  unitId: string | null;
  unitName: string;
  total: number;
  promoters: number;
  passives: number;
  detractors: number;
  nps: number | null;
  promoterPct: number | null;
  passivePct: number | null;
  detractorPct: number | null;
  sentiment: SentimentMix;
  treatment: TreatmentStats;
  cases: { opened: number; closed: number; open: number; overdue: number; unassigned: number };
  reviews: { averageRating: number | null; totalReviews: number };
};

type RankingSummary = {
  from: string;
  to: string;
  unitId: string | null;
  totals: RankingUnitSnapshot;
  units: RankingUnitSnapshot[];
};

type RankingMonthlyPoint = {
  month: string;
  total: number;
  promoters: number;
  passives: number;
  detractors: number;
  nps: number | null;
  sentiment: { elogio: number; reclamacao: number; neutro: number };
  treatment: {
    detractors: number;
    withCase: number;
    caseOpen: number;
    caseClosed: number;
    withoutCase: number;
    withCasePct: number | null;
    resolvedOfDetractorsPct: number | null;
    resolvedOfCasesPct: number | null;
  };
  casesOpened: number;
  casesResolved: number;
};

type RankingMonthlySeries = {
  unitId: string | null;
  unitName: string;
  points: RankingMonthlyPoint[];
};

type RankingMonthly = {
  months: string[];
  series: RankingMonthlySeries[];
};

type PeriodPreset = '6m' | '12m' | '90d' | 'custom';

const UNIT_LINE_COLORS = ['#0284c7', '#059669', '#d97706', '#e11d48', '#7c3aed', '#0891b2', '#ea580c', '#4f46e5'];
const DEMAIS_COLOR = '#64748b';
const CHART_UNIT_LIMIT = 8;
const NPS_PROMOTER = '#10b981';
const NPS_PASSIVE = '#f59e0b';
const NPS_DETRACTOR = '#f43f5e';
const SENT_ELOGIO = '#10b981';
const SENT_RECLAMACAO = '#f43f5e';
const SENT_NEUTRO = '#64748b';

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function rangeForPreset(preset: Exclude<PeriodPreset, 'custom'>): { from: string; to: string } {
  const now = new Date();
  const to = toIsoDate(now);
  if (preset === '90d') {
    const fromDate = new Date(now.getTime() - 89 * 24 * 60 * 60 * 1000);
    return { from: toIsoDate(fromDate), to };
  }
  const monthsBack = preset === '12m' ? 11 : 6;
  const fromDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 1));
  return { from: toIsoDate(fromDate), to };
}

function fmtPct(value: number | null | undefined) {
  return typeof value === 'number' ? `${value}%` : '—';
}

function fmtNps(value: number | null | undefined) {
  return typeof value === 'number' ? String(value) : '—';
}

function fmtHours(value: number | null | undefined) {
  if (typeof value !== 'number') return '—';
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`;
}

function fmtMonth(ym: string) {
  const [year, month] = ym.split('-').map(Number);
  if (!year || !month) return ym;
  const d = new Date(Date.UTC(year, month - 1, 1));
  return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' });
}

function npsClassName(nps: number | null | undefined) {
  if (typeof nps !== 'number') return 'text-slate-500';
  return nps >= 0 ? 'text-emerald-600' : 'text-rose-600';
}

function seriesKey(row: { unitId: string | null }) {
  return row.unitId ?? 'none';
}

function percentOf(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function aggregateDemais(hidden: RankingMonthlySeries[]): RankingMonthlySeries {
  const months = hidden[0]?.points.map((p) => p.month) ?? [];
  return {
    unitId: '__others__',
    unitName: 'Demais',
    points: months.map((month, idx) => {
      const pts = hidden.map((s) => s.points[idx]);
      const total = pts.reduce((sum, p) => sum + p.total, 0);
      const promoters = pts.reduce((sum, p) => sum + p.promoters, 0);
      const passives = pts.reduce((sum, p) => sum + p.passives, 0);
      const detractors = pts.reduce((sum, p) => sum + p.detractors, 0);
      const nps = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : null;
      const tDetractors = pts.reduce((sum, p) => sum + p.treatment.detractors, 0);
      const withCase = pts.reduce((sum, p) => sum + p.treatment.withCase, 0);
      const caseOpen = pts.reduce((sum, p) => sum + p.treatment.caseOpen, 0);
      const caseClosed = pts.reduce((sum, p) => sum + p.treatment.caseClosed, 0);
      return {
        month,
        total,
        promoters,
        passives,
        detractors,
        nps,
        sentiment: {
          elogio: pts.reduce((sum, p) => sum + p.sentiment.elogio, 0),
          reclamacao: pts.reduce((sum, p) => sum + p.sentiment.reclamacao, 0),
          neutro: pts.reduce((sum, p) => sum + p.sentiment.neutro, 0),
        },
        treatment: {
          detractors: tDetractors,
          withCase,
          caseOpen,
          caseClosed,
          withoutCase: Math.max(0, tDetractors - withCase),
          withCasePct: tDetractors > 0 ? Math.round((withCase / tDetractors) * 100) : null,
          resolvedOfDetractorsPct: tDetractors > 0 ? Math.round((caseClosed / tDetractors) * 100) : null,
          resolvedOfCasesPct: withCase > 0 ? Math.round((caseClosed / withCase) * 100) : null,
        },
        casesOpened: pts.reduce((sum, p) => sum + p.casesOpened, 0),
        casesResolved: pts.reduce((sum, p) => sum + p.casesResolved, 0),
      };
    }),
  };
}

export function RankingPage() {
  const navigate = useNavigate();
  const initial = rangeForPreset('6m');
  const [preset, setPreset] = useState<PeriodPreset>('6m');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [unitId, setUnitId] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());

  const units = useQuery({
    queryKey: ['units'],
    queryFn: () => apiFetch<Unit[]>('/units'),
  });

  const qs = `${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${
    unitId ? `&unitId=${encodeURIComponent(unitId)}` : ''
  }`;

  const summary = useQuery({
    queryKey: ['metrics', 'rankingSummary', from, to, unitId],
    queryFn: () => apiFetch<RankingSummary>(`/metrics/ranking/summary?from=${qs}`),
  });

  const monthly = useQuery({
    queryKey: ['metrics', 'rankingMonthly', from, to, unitId],
    queryFn: () => apiFetch<RankingMonthly>(`/metrics/ranking/monthly?from=${qs}`),
  });

  const seriesIdKey = monthly.data?.series.map((s) => seriesKey(s)).join(',') ?? '';

  useEffect(() => {
    if (!seriesIdKey) return;
    const ids = seriesIdKey.split(',');
    if (ids.length <= CHART_UNIT_LIMIT) {
      setHiddenKeys(new Set());
      return;
    }
    setHiddenKeys(new Set(ids.slice(CHART_UNIT_LIMIT)));
  }, [seriesIdKey]);

  const chartSeries = useMemo(() => {
    const all = monthly.data?.series ?? [];
    if (!all.length) return [] as Array<RankingMonthlySeries & { color: string }>;
    const hidden = all.filter((s) => hiddenKeys.has(seriesKey(s)));
    const visible = all.filter((s) => !hiddenKeys.has(seriesKey(s)));
    const colored = visible.map((s, i) => ({
      ...s,
      color: UNIT_LINE_COLORS[i % UNIT_LINE_COLORS.length],
    }));
    if (hidden.length) colored.push({ ...aggregateDemais(hidden), color: DEMAIS_COLOR });
    return colored;
  }, [monthly.data, hiddenKeys]);

  const treatmentRanked = useMemo(() => {
    const rows = [...(summary.data?.units ?? [])];
    rows.sort((a, b) => {
      const ar = a.treatment.resolvedOfDetractorsPct;
      const br = b.treatment.resolvedOfDetractorsPct;
      if (ar === null && br !== null) return 1;
      if (ar !== null && br === null) return -1;
      if (ar !== null && br !== null && ar !== br) return br - ar;
      const aw = a.treatment.withCasePct;
      const bw = b.treatment.withCasePct;
      if (aw === null && bw !== null) return 1;
      if (aw !== null && bw === null) return -1;
      if (aw !== null && bw !== null && aw !== bw) return bw - aw;
      return a.unitName.localeCompare(b.unitName, 'pt-BR');
    });
    return rows;
  }, [summary.data]);

  function applyPreset(next: PeriodPreset) {
    setPreset(next);
    if (next === 'custom') return;
    const range = rangeForPreset(next);
    setFrom(range.from);
    setTo(range.to);
  }

  function goFeedbacks(extra?: Record<string, string>, rowUnitId?: string | null) {
    const params = new URLSearchParams();
    params.set('case', 'all');
    params.set('from', from);
    params.set('to', to);
    const uid = rowUnitId || unitId;
    if (uid) params.set('unitId', uid);
    for (const [k, v] of Object.entries(extra ?? {})) {
      if (v) params.set(k, v);
    }
    navigate(`/app/feedbacks?${params.toString()}`);
  }

  function goKanban(extra?: Record<string, string>, rowUnitId?: string | null) {
    const params = new URLSearchParams();
    params.set('case', 'open');
    const uid = rowUnitId || unitId;
    if (uid) params.set('unitId', uid);
    for (const [k, v] of Object.entries(extra ?? {})) {
      if (v) params.set(k, v);
    }
    navigate(`/app/feedbacks/kanban?${params.toString()}`);
  }

  const totals = summary.data?.totals;
  const loading = summary.isLoading || monthly.isLoading;
  const errored = summary.isError || monthly.isError;
  const empty = Boolean(summary.data && summary.data.totals.total === 0 && summary.data.totals.cases.opened === 0);

  return (
    <div className="grid gap-6">
      <div>
        <div className="text-xl font-semibold">Ranking de unidades</div>
        <div className="text-sm text-slate-600">Comparação e evolução mensal de NPS, feedback, tratamento de detratores e casos</div>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-slate-900">Filtros</div>
            <div className="text-sm text-slate-600">Período e unidade</div>
          </div>
          <Button variant="secondary" onClick={() => setFiltersOpen((v) => !v)}>
            {filtersOpen ? 'Recolher' : 'Abrir'}
          </Button>
        </div>

        {filtersOpen && (
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">Período</div>
              <select
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                value={preset}
                onChange={(e) => applyPreset(e.target.value as PeriodPreset)}
              >
                <option value="6m">Últimos 6 meses + atual</option>
                <option value="12m">Últimos 12 meses</option>
                <option value="90d">Últimos 90 dias</option>
                <option value="custom">Personalizado</option>
              </select>
            </div>
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">De</div>
              <Input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPreset('custom');
                }}
              />
            </div>
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">Até</div>
              <Input
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPreset('custom');
                }}
              />
            </div>
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">Unidade</div>
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
          </div>
        )}
      </Card>

      {loading && (
        <Card>
          <div className="text-sm text-slate-600">Carregando ranking...</div>
        </Card>
      )}
      {errored && (
        <Card>
          <div className="text-sm text-rose-700">Falha ao carregar o ranking</div>
        </Card>
      )}

      {summary.data && totals && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card title="NPS geral" description={`${from} → ${to}`}>
              <div className={['text-2xl font-semibold', npsClassName(totals.nps)].join(' ')}>{fmtNps(totals.nps)}</div>
            </Card>
            <button type="button" className="text-left" onClick={() => goFeedbacks()}>
              <Card title="Respostas" description="Concluídas no período">
                <div className="text-2xl font-semibold">{totals.total}</div>
              </Card>
            </button>
            <button type="button" className="text-left" onClick={() => goFeedbacks({ npsClass: 'detractor' })}>
              <Card title="Detratores tratados" description="% com caso aberto ou resolvido">
                <div className="text-2xl font-semibold">{fmtPct(totals.treatment.withCasePct)}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {totals.treatment.withCase} de {totals.treatment.detractors} detratores
                </div>
              </Card>
            </button>
            <button type="button" className="text-left" onClick={() => goKanban()}>
              <Card title="Casos abertos" description="Criados no período e ainda abertos">
                <div className="text-2xl font-semibold">{totals.cases.open}</div>
              </Card>
            </button>
          </div>

          {empty && (
            <Card>
              <div className="text-sm text-slate-600">Sem respostas nem casos no período selecionado</div>
            </Card>
          )}

          <Card title="NPS por unidade" description="Ordenado do maior para o menor NPS">
            <NpsHorizontalBars
              rows={summary.data.units}
              onSelect={(row) => {
                if (row.unitId) goFeedbacks({}, row.unitId);
              }}
            />
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Mix NPS por unidade" description="Promotores, passivos e detratores">
              <StackedUnitBars
                rows={summary.data.units.map((row) => ({
                  key: row.unitId ?? 'none',
                  label: row.unitName,
                  segments: [
                    { value: row.promoters, color: NPS_PROMOTER, title: 'Promotores' },
                    { value: row.passives, color: NPS_PASSIVE, title: 'Passivos' },
                    { value: row.detractors, color: NPS_DETRACTOR, title: 'Detratores' },
                  ],
                }))}
                legend={[
                  { label: 'Promotores', color: NPS_PROMOTER },
                  { label: 'Passivos', color: NPS_PASSIVE },
                  { label: 'Detratores', color: NPS_DETRACTOR },
                ]}
              />
            </Card>
            <Card title="Análise de feedback por unidade" description="Somente respostas classificadas">
              <StackedUnitBars
                rows={summary.data.units.map((row) => ({
                  key: row.unitId ?? 'none',
                  label: row.unitName,
                  segments: [
                    { value: row.sentiment.elogio, color: SENT_ELOGIO, title: 'Elogio' },
                    { value: row.sentiment.reclamacao, color: SENT_RECLAMACAO, title: 'Reclamação' },
                    { value: row.sentiment.neutro, color: SENT_NEUTRO, title: 'Neutro' },
                  ],
                }))}
                legend={[
                  { label: 'Elogio', color: SENT_ELOGIO },
                  { label: 'Reclamação', color: SENT_RECLAMACAO },
                  { label: 'Neutro', color: SENT_NEUTRO },
                ]}
              />
            </Card>
          </div>

          <Card title="Ranking de unidades" description={`${from} → ${to} · clique no nome para ver os feedbacks`}>
            <RankingTable
              rows={summary.data.units}
              onUnit={(row) => {
                if (row.unitId) goFeedbacks({}, row.unitId);
              }}
              onDetractors={(row) => {
                if (row.unitId) goFeedbacks({ npsClass: 'detractor' }, row.unitId);
              }}
              onCases={(row) => {
                if (row.unitId) goKanban({}, row.unitId);
              }}
            />
          </Card>

          <Card
            title="Tratamento dado aos detratores"
            description="Detrator (NPS 0–6) sem FeedbackCase vinculado conta como sem tratamento. Casos resolvidos, encerrados ou descartados contam como resolvidos."
          >
            <div className="grid gap-6 lg:grid-cols-2">
              <TreatmentFunnel totals={totals.treatment} />
              <div className="grid gap-3">
                <div className="text-sm font-medium text-slate-900">Tempos (casos de detratores)</div>
                <div className="grid gap-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">1ª ação (média / mediana)</span>
                    <span className="font-medium text-slate-900">
                      {fmtHours(totals.treatment.avgHoursToFirstAction)} / {fmtHours(totals.treatment.medianHoursToFirstAction)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Encerramento (média / mediana)</span>
                    <span className="font-medium text-slate-900">
                      {fmtHours(totals.treatment.avgHoursToClose)} / {fmtHours(totals.treatment.medianHoursToClose)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">% casos resolvidos</span>
                    <span className="font-medium text-slate-900">{fmtPct(totals.treatment.resolvedOfCasesPct)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">% no prazo</span>
                    <span className="font-medium text-slate-900">{fmtPct(totals.treatment.onTimePct)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Vencidos / sem responsável</span>
                    <span className="font-medium text-slate-900">
                      {totals.treatment.caseOverdue} / {totals.treatment.caseUnassigned}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6">
              <div className="mb-3 text-sm font-medium text-slate-900">Mix de tratamento por unidade</div>
              <StackedUnitBars
                rows={summary.data.units.map((row) => ({
                  key: row.unitId ?? 'none',
                  label: row.unitName,
                  segments: [
                    { value: row.treatment.withoutCase, color: '#94a3b8', title: 'Sem tratamento' },
                    { value: row.treatment.caseOpen, color: NPS_PASSIVE, title: 'Em andamento' },
                    { value: row.treatment.caseClosed, color: NPS_PROMOTER, title: 'Resolvidos' },
                  ],
                }))}
                legend={[
                  { label: 'Sem tratamento', color: '#94a3b8' },
                  { label: 'Em andamento', color: NPS_PASSIVE },
                  { label: 'Resolvidos', color: NPS_PROMOTER },
                ]}
              />
            </div>
          </Card>

          <Card title="Ranking de tratamento" description="Ordenado por % de detratores com caso resolvido">
            <div className="overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Unidade</th>
                    <th className="py-2 pr-3 font-medium">Detratores</th>
                    <th className="py-2 pr-3 font-medium">Com caso</th>
                    <th className="py-2 pr-3 font-medium">Sem tratamento</th>
                    <th className="py-2 pr-3 font-medium">Resolvidos</th>
                    <th className="py-2 pr-3 font-medium">% com caso</th>
                    <th className="py-2 pr-3 font-medium">% resolvidos</th>
                    <th className="py-2 pr-3 font-medium">% no prazo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {treatmentRanked.map((row) => (
                    <tr
                      key={row.unitId ?? 'none'}
                      className={row.unitId ? 'cursor-pointer hover:bg-slate-50' : ''}
                      onClick={() => {
                        if (row.unitId) goFeedbacks({ npsClass: 'detractor' }, row.unitId);
                      }}
                    >
                      <td className="py-2 pr-3 font-medium text-sky-800">{row.unitName}</td>
                      <td className="py-2 pr-3">{row.treatment.detractors}</td>
                      <td className="py-2 pr-3">{row.treatment.withCase}</td>
                      <td className="py-2 pr-3">{row.treatment.withoutCase}</td>
                      <td className="py-2 pr-3">{row.treatment.caseClosed}</td>
                      <td className="py-2 pr-3">{fmtPct(row.treatment.withCasePct)}</td>
                      <td className="py-2 pr-3">{fmtPct(row.treatment.resolvedOfDetractorsPct)}</td>
                      <td className="py-2 pr-3">{fmtPct(row.treatment.onTimePct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {monthly.data && (
        <Card title="Evolução mês a mês" description="Meses sem movimento aparecem com NPS vazio e volume 0">
          {(monthly.data.series.length > CHART_UNIT_LIMIT || hiddenKeys.size > 0) && (
            <div className="mb-4 flex flex-wrap gap-2">
              {monthly.data.series.map((s) => {
                const key = seriesKey(s);
                const hidden = hiddenKeys.has(key);
                return (
                  <button
                    key={key}
                    type="button"
                    className={[
                      'rounded-full border px-3 py-1 text-xs',
                      hidden ? 'border-slate-200 bg-white text-slate-400' : 'border-slate-300 bg-slate-100 text-slate-800',
                    ].join(' ')}
                    onClick={() => {
                      setHiddenKeys((prev) => {
                        const next = new Set(prev);
                        if (next.has(key)) next.delete(key);
                        else next.add(key);
                        return next;
                      });
                    }}
                  >
                    {s.unitName}
                  </button>
                );
              })}
            </div>
          )}

          <div className="grid gap-6">
            <div>
              <div className="mb-2 text-sm font-medium text-slate-900">NPS por mês</div>
              <MultiLineChart
                months={monthly.data.months}
                series={chartSeries.map((s) => ({
                  key: seriesKey(s),
                  label: s.unitName,
                  color: s.color,
                  values: s.points.map((p) => p.nps),
                }))}
                yMin={-100}
                yMax={100}
                formatValue={fmtNps}
              />
            </div>
            <div>
              <div className="mb-2 text-sm font-medium text-slate-900">Respostas por mês</div>
              <MonthlyStackedBars
                months={monthly.data.months}
                series={chartSeries.map((s) => ({
                  key: seriesKey(s),
                  label: s.unitName,
                  color: s.color,
                  values: s.points.map((p) => p.total),
                }))}
              />
            </div>
            <div>
              <div className="mb-2 text-sm font-medium text-slate-900">% detratores resolvidos por mês</div>
              <MultiLineChart
                months={monthly.data.months}
                series={chartSeries.map((s) => ({
                  key: seriesKey(s),
                  label: s.unitName,
                  color: s.color,
                  values: s.points.map((p) => p.treatment.resolvedOfDetractorsPct),
                }))}
                yMin={0}
                yMax={100}
                formatValue={fmtPct}
              />
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function NpsHorizontalBars(props: {
  rows: RankingUnitSnapshot[];
  onSelect?: (row: RankingUnitSnapshot) => void;
}) {
  if (!props.rows.length) return <div className="text-sm text-slate-600">Sem unidades no escopo</div>;

  return (
    <div className="grid gap-3">
      {props.rows.map((row) => {
        const nps = row.nps;
        const width = typeof nps === 'number' ? Math.abs(nps) / 2 : 0;
        const content = (
          <div className="grid gap-1">
            <div className="flex items-center justify-between gap-3 text-sm">
              <div className="font-medium text-slate-900">
                <span className="mr-2 text-xs text-slate-400">{row.rank}º</span>
                {row.unitName}
              </div>
              <div className={['font-semibold', npsClassName(nps)].join(' ')}>{fmtNps(nps)}</div>
            </div>
            <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="absolute left-1/2 top-0 h-full w-px bg-slate-300" />
              {typeof nps === 'number' && nps !== 0 && (
                <div
                  className={['absolute top-0 h-full', nps >= 0 ? 'left-1/2 bg-emerald-500' : 'bg-rose-500'].join(' ')}
                  style={nps >= 0 ? { width: `${width}%` } : { right: '50%', width: `${width}%` }}
                />
              )}
            </div>
          </div>
        );
        if (!props.onSelect || !row.unitId) return <div key={row.unitId ?? 'none'}>{content}</div>;
        return (
          <button key={row.unitId} type="button" className="w-full rounded-md text-left hover:bg-slate-50" onClick={() => props.onSelect!(row)}>
            {content}
          </button>
        );
      })}
    </div>
  );
}

function StackedUnitBars(props: {
  rows: Array<{ key: string; label: string; segments: Array<{ value: number; color: string; title: string }> }>;
  legend: Array<{ label: string; color: string }>;
}) {
  const max = Math.max(1, ...props.rows.map((row) => row.segments.reduce((sum, s) => sum + s.value, 0)));
  if (!props.rows.length) return <div className="text-sm text-slate-600">Sem dados</div>;

  return (
    <div className="grid gap-3">
      {props.rows.map((row) => {
        const total = row.segments.reduce((sum, s) => sum + s.value, 0);
        return (
          <div key={row.key} className="grid gap-1">
            <div className="flex items-center justify-between gap-3 text-sm">
              <div className="font-medium text-slate-900">{row.label}</div>
              <div className="text-slate-600">{total}</div>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="flex h-full" style={{ width: `${Math.max((total / max) * 100, total > 0 ? 8 : 0)}%` }}>
                {row.segments.map((seg) =>
                  seg.value > 0 ? (
                    <div
                      key={seg.title}
                      title={`${seg.title}: ${seg.value}`}
                      style={{ width: `${percentOf(seg.value, total)}%`, backgroundColor: seg.color }}
                    />
                  ) : null,
                )}
              </div>
            </div>
          </div>
        );
      })}
      <div className="flex flex-wrap gap-3 text-xs text-slate-600">
        {props.legend.map((item) => (
          <span key={item.label} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function TreatmentFunnel(props: { totals: TreatmentStats }) {
  const steps = [
    { label: 'Detratores', value: props.totals.detractors, color: NPS_DETRACTOR },
    { label: 'Com caso', value: props.totals.withCase, color: '#fb7185' },
    { label: 'Em andamento', value: props.totals.caseOpen, color: NPS_PASSIVE },
    { label: 'Resolvidos', value: props.totals.caseClosed, color: NPS_PROMOTER },
  ];
  const max = Math.max(1, ...steps.map((s) => s.value));

  return (
    <div className="grid gap-3">
      <div className="text-sm font-medium text-slate-900">Funil</div>
      {steps.map((step) => (
        <div key={step.label} className="grid gap-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-700">{step.label}</span>
            <span className="font-medium text-slate-900">
              {step.value} {props.totals.detractors > 0 ? `(${percentOf(step.value, props.totals.detractors)}%)` : ''}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full" style={{ width: `${(step.value / max) * 100}%`, backgroundColor: step.color }} />
          </div>
        </div>
      ))}
      <div className="text-xs text-slate-500">Sem tratamento: {props.totals.withoutCase}</div>
    </div>
  );
}

function RankingTable(props: {
  rows: RankingUnitSnapshot[];
  onUnit: (row: RankingUnitSnapshot) => void;
  onDetractors: (row: RankingUnitSnapshot) => void;
  onCases: (row: RankingUnitSnapshot) => void;
}) {
  if (!props.rows.length) return <div className="text-sm text-slate-600">Sem unidades no escopo</div>;

  return (
    <div className="overflow-auto">
      <table className="w-full min-w-[1100px] text-left text-sm">
        <thead className="border-b border-slate-200 text-slate-500">
          <tr>
            <th className="py-2 pr-3 font-medium">#</th>
            <th className="py-2 pr-3 font-medium">Unidade</th>
            <th className="py-2 pr-3 font-medium">NPS</th>
            <th className="py-2 pr-3 font-medium">Resp.</th>
            <th className="py-2 pr-3 font-medium">% Prom.</th>
            <th className="py-2 pr-3 font-medium">% Pass.</th>
            <th className="py-2 pr-3 font-medium">% Detr.</th>
            <th className="py-2 pr-3 font-medium">Elogio</th>
            <th className="py-2 pr-3 font-medium">Reclam.</th>
            <th className="py-2 pr-3 font-medium">Neutro</th>
            <th className="py-2 pr-3 font-medium">% tratados</th>
            <th className="py-2 pr-3 font-medium">% resolv.</th>
            <th className="py-2 pr-3 font-medium">Abertos</th>
            <th className="py-2 pr-3 font-medium">Fechados</th>
            <th className="py-2 pr-3 font-medium">Vencidos</th>
            <th className="py-2 pr-3 font-medium">Sem resp.</th>
            <th className="py-2 pr-3 font-medium">Reviews</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {props.rows.map((row) => (
            <tr key={row.unitId ?? 'none'} className="hover:bg-slate-50">
              <td className="py-2 pr-3 text-slate-500">{row.rank}</td>
              <td className="py-2 pr-3">
                {row.unitId ? (
                  <button type="button" className="font-medium text-sky-800 hover:underline" onClick={() => props.onUnit(row)}>
                    {row.unitName}
                  </button>
                ) : (
                  row.unitName
                )}
              </td>
              <td className={['py-2 pr-3 font-semibold', npsClassName(row.nps)].join(' ')}>{fmtNps(row.nps)}</td>
              <td className="py-2 pr-3">{row.total}</td>
              <td className="py-2 pr-3">{fmtPct(row.promoterPct)}</td>
              <td className="py-2 pr-3">{fmtPct(row.passivePct)}</td>
              <td className="py-2 pr-3">{fmtPct(row.detractorPct)}</td>
              <td className="py-2 pr-3">{row.sentiment.elogio}</td>
              <td className="py-2 pr-3">{row.sentiment.reclamacao}</td>
              <td className="py-2 pr-3">{row.sentiment.neutro}</td>
              <td className="py-2 pr-3">
                <button type="button" className="hover:underline" onClick={() => props.onDetractors(row)}>
                  {fmtPct(row.treatment.withCasePct)}
                </button>
              </td>
              <td className="py-2 pr-3">{fmtPct(row.treatment.resolvedOfDetractorsPct)}</td>
              <td className="py-2 pr-3">
                <button type="button" className="hover:underline" onClick={() => props.onCases(row)}>
                  {row.cases.open}
                </button>
              </td>
              <td className="py-2 pr-3">{row.cases.closed}</td>
              <td className="py-2 pr-3">{row.cases.overdue}</td>
              <td className="py-2 pr-3">{row.cases.unassigned}</td>
              <td className="py-2 pr-3">
                {row.reviews.totalReviews > 0
                  ? `${row.reviews.averageRating?.toFixed(1) ?? '—'} (${row.reviews.totalReviews})`
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MultiLineChart(props: {
  months: string[];
  series: Array<{ key: string; label: string; color: string; values: Array<number | null> }>;
  yMin: number;
  yMax: number;
  formatValue: (value: number | null) => string;
}) {
  if (!props.months.length || !props.series.length) {
    return <div className="text-sm text-slate-600">Sem dados</div>;
  }

  const width = 100;
  const height = 36;
  const padX = 4;
  const padY = 4;
  const xAt = (i: number) => {
    if (props.months.length === 1) return width / 2;
    return padX + (i / (props.months.length - 1)) * (width - padX * 2);
  };
  const yAt = (v: number) => {
    const ratio = (props.yMax - v) / (props.yMax - props.yMin);
    return padY + ratio * (height - padY * 2);
  };

  const polylines = props.series.map((s) => {
    const segments: string[] = [];
    let current: string[] = [];
    s.values.forEach((value, i) => {
      if (typeof value !== 'number') {
        if (current.length) {
          segments.push(current.join(' '));
          current = [];
        }
        return;
      }
      current.push(`${xAt(i).toFixed(2)},${yAt(value).toFixed(2)}`);
    });
    if (current.length) segments.push(current.join(' '));
    return { ...s, segments };
  });

  const zeroY = props.yMin < 0 && props.yMax > 0 ? yAt(0) : null;

  return (
    <div className="grid gap-3">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full">
          {zeroY !== null && (
            <line x1="0" x2={String(width)} y1={String(zeroY)} y2={String(zeroY)} stroke="#cbd5e1" strokeWidth="0.6" />
          )}
          {polylines.map((s) =>
            s.segments.map((points, idx) => (
              <polyline
                key={`${s.key}-${idx}`}
                points={points}
                fill="none"
                stroke={s.color}
                strokeWidth="1.6"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )),
          )}
        </svg>
        <div className="mt-2 flex flex-wrap justify-between gap-2 text-[10px] text-slate-500">
          {props.months.map((m) => (
            <span key={m}>{fmtMonth(m)}</span>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-slate-600">
        {props.series.map((s) => {
          const last = [...s.values].reverse().find((v) => typeof v === 'number') ?? null;
          return (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
              <span className="text-slate-400">{props.formatValue(last)}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function MonthlyStackedBars(props: {
  months: string[];
  series: Array<{ key: string; label: string; color: string; values: number[] }>;
}) {
  if (!props.months.length || !props.series.length) {
    return <div className="text-sm text-slate-600">Sem dados</div>;
  }
  const totals = props.months.map((_, i) => props.series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0));
  const max = Math.max(1, ...totals);

  return (
    <div className="grid gap-3">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="flex h-40 items-end gap-1">
          {props.months.map((month, i) => (
            <div key={month} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div className="flex h-32 w-full max-w-[2.5rem] flex-col-reverse overflow-hidden rounded-sm bg-white">
                {props.series.map((s) => {
                  const value = s.values[i] ?? 0;
                  if (value <= 0) return null;
                  return (
                    <div
                      key={s.key}
                      title={`${s.label}: ${value}`}
                      style={{ height: `${(value / max) * 100}%`, backgroundColor: s.color }}
                    />
                  );
                })}
              </div>
              <div className="truncate text-[10px] text-slate-500">{fmtMonth(month)}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-slate-600">
        {props.series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
