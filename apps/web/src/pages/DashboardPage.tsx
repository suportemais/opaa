import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { sentimentLabel, sentimentThemeLabel } from '../lib/labels';

type Unit = { id: string; name: string };
type AuthMe = { name: string };
type NpsSummary = { total: number; promoters: number; passives: number; detractors: number; nps: number | null };
type NpsByUnitRow = NpsSummary & { unitId: string | null; unitName: string | null };
type NpsByUnit = { units: NpsByUnitRow[] };
type NpsByDayPoint = NpsSummary & { date: string };
type NpsByDay = { points: NpsByDayPoint[] };
type CasesSummary = {
  totals: { total: number; open: number; closed: number };
  assignees: { unassigned: number; assigned: number };
  due: { overdue: number; today: number; next7: number; noDue: number };
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
};

type SentimentCounts = { elogio: number; reclamacao: number; neutro: number };
type SentimentThemeRow = SentimentCounts & { theme: string; total: number };
type SentimentSummary = {
  responses: number;
  classified: number;
  unclassified: number;
  counts: SentimentCounts;
  percents: SentimentCounts;
  byTheme: SentimentThemeRow[];
  groqConfigured: boolean;
};

type ReviewPlatform = 'google' | 'ifood' | 'tripadvisor' | 'reclameaqui';
type ReviewPlatformCard = {
  platform: ReviewPlatform;
  averageRating: number;
  totalReviews: number;
  lastSyncAt: string | null;
  syncStatus: string | null;
  publicUrl: string | null;
};

const REVIEW_CARD_META: Record<ReviewPlatform, { label: string; color: string; icon: string }> = {
  google:      { label: 'Google',        color: 'from-sky-500 to-blue-600', icon: '🔍' },
  ifood:       { label: 'iFood',         color: 'from-rose-500 to-red-600', icon: '🍔' },
  tripadvisor: { label: 'Tripadvisor',   color: 'from-emerald-500 to-teal-600', icon: '✈️' },
  reclameaqui: { label: 'Reclame Aqui',  color: 'from-amber-500 to-orange-600', icon: '📣' },
};

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [rangeDays, setRangeDays] = useState(30);
  const [unitId, setUnitId] = useState<string>('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const me = useQuery({ queryKey: ['authMe'], queryFn: () => apiFetch<AuthMe>('/auth/me') });

  const permissionCodes = useQuery({
    queryKey: ['authMePermissions'],
    queryFn: () => apiFetch<{ permissionCodes: string[] }>('/auth/me').then((r) => r.permissionCodes).catch(() => [] as string[]),
    staleTime: 60 * 1000,
  });

  const canReviewRead = (permissionCodes.data ?? [] as string[]).includes('review:read');

  const units = useQuery({
    queryKey: ['units'],
    queryFn: () => apiFetch<Unit[]>('/units'),
  });

  const { from, to } = useMemo(() => {
    const now = new Date();
    const fromDate = new Date(now.getTime() - (rangeDays - 1) * 24 * 60 * 60 * 1000);
    return { from: toIsoDate(fromDate), to: toIsoDate(now) };
  }, [rangeDays]);

  const reviewCards = useQuery({
    queryKey: ['metrics', 'reviews', 'platformCards', from, to, unitId],
    queryFn: () =>
      apiFetch<{ cards: ReviewPlatformCard[] }>(
        `/metrics/reviews/platform-cards?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${unitId ? `&unitId=${encodeURIComponent(unitId)}` : ''}`,
      ),
    enabled: canReviewRead,
  });

  const summary = useQuery({
    queryKey: ['metrics', 'npsSummary', from, to, unitId],
    queryFn: () =>
      apiFetch<NpsSummary>(
        `/metrics/nps/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${
          unitId ? `&unitId=${encodeURIComponent(unitId)}` : ''
        }`,
      ),
  });

  const byDay = useQuery({
    queryKey: ['metrics', 'npsByDay', from, to, unitId],
    queryFn: () =>
      apiFetch<NpsByDay>(
        `/metrics/nps/by-day?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${
          unitId ? `&unitId=${encodeURIComponent(unitId)}` : ''
        }`,
      ),
  });

  const casesSummary = useQuery({
    queryKey: ['metrics', 'casesSummary', unitId],
    queryFn: () =>
      apiFetch<CasesSummary>(`/metrics/cases/summary${unitId ? `?unitId=${encodeURIComponent(unitId)}` : ''}`),
  });

  const byUnit = useQuery({
    queryKey: ['metrics', 'npsByUnit', from, to],
    queryFn: () => apiFetch<NpsByUnit>(`/metrics/nps/by-unit?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
    enabled: !unitId,
  });

  const sentiment = useQuery({
    queryKey: ['metrics', 'sentimentSummary', from, to, unitId],
    queryFn: () =>
      apiFetch<SentimentSummary>(
        `/metrics/sentiment/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${
          unitId ? `&unitId=${encodeURIComponent(unitId)}` : ''
        }`,
      ),
  });

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ processed: number }>('/metrics/sentiment/backfill', { method: 'POST', json: { limit: 5 } })
      .then((res) => {
        if (!cancelled && res.processed > 0) {
          void queryClient.invalidateQueries({ queryKey: ['metrics', 'sentimentSummary'] });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [from, to, unitId, queryClient]);

  function goFeedbacks(extra?: Record<string, string>) {
    const params = new URLSearchParams();
    params.set('case', 'all');
    params.set('from', from);
    params.set('to', to);
    if (unitId) params.set('unitId', unitId);
    for (const [k, v] of Object.entries(extra ?? {})) {
      if (v) params.set(k, v);
    }
    navigate(`/app/feedbacks?${params.toString()}`);
  }

  function goKanban(extra?: Record<string, string>) {
    const params = new URLSearchParams();
    params.set('case', 'open');
    for (const [k, v] of Object.entries(extra ?? {})) {
      if (v) params.set(k, v);
    }
    navigate(`/app/feedbacks/kanban?${params.toString()}`);
  }

  return (
    <div className="grid gap-6">
      <div>
        <div className="text-xl font-semibold">
          {(() => {
            const h = new Date().getHours();
            const greet = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
            const name = me.data?.name?.trim() ? me.data.name.trim().split(' ')[0] : null;
            return `${greet}${name ? `, ${name}` : ''}. Que bom ter você de volta.`;
          })()}
        </div>
        <div className="text-sm text-slate-600">Resumo e navegação rápida por métricas</div>
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
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">Período</div>
              <select
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                value={String(rangeDays)}
                onChange={(e) => setRangeDays(Number(e.target.value))}
              >
                <option value="7">Últimos 7 dias</option>
                <option value="30">Últimos 30 dias</option>
                <option value="90">Últimos 90 dias</option>
              </select>
            </div>
            <div className="md:col-span-2">
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

      {canReviewRead && (
        <Card title="Avaliações por plataforma" description={`Período ${from} → ${to} · ${unitId ? 'Filtrado por unidade selecionada' : 'Todas as unidades'}`}>
          {reviewCards.isLoading && <div className="text-sm text-slate-600">Carregando...</div>}
          {reviewCards.isError && <div className="text-sm text-rose-700">Falha ao carregar avaliações</div>}
          {reviewCards.data?.cards && (
            <div className="grid gap-4 md:grid-cols-4">
              {reviewCards.data.cards.map((card) => {
                const meta = REVIEW_CARD_META[card.platform];
                const rating = typeof card.averageRating === 'number' ? card.averageRating : 0;
                const total = card.totalReviews ?? 0;
                const colorStar = rating >= 4.5 ? 'text-amber-500' : rating >= 4 ? 'text-yellow-500' : rating >= 3 ? 'text-orange-500' : rating > 0 ? 'text-rose-500' : 'text-slate-400';
                const ratingFmt = rating > 0 || total > 0 ? rating.toFixed(1) : '0,0';
                return (
                  <div
                    key={card.platform}
                    className="grid gap-3 rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-3">
                      <div className={['flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-xl text-white shadow-sm', meta.color].join(' ')}>
                        {meta.icon}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{meta.label}</div>
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <span className="text-slate-400">Último sync:</span>
                          {card.lastSyncAt
                            ? new Date(card.lastSyncAt).toLocaleString('pt-BR')
                            : 'Pendente'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className={['text-3xl font-bold', colorStar].join(' ')}>★ {ratingFmt}</span>
                      <span className="text-xs text-slate-500">/ 5,0</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-600">{total.toLocaleString('pt-BR')} avaliações</span>
                      {card.publicUrl && (
                        <a className="text-xs text-sky-700 hover:underline" href={card.publicUrl} target="_blank" rel="noreferrer">
                          Ver ↗
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card title="Unidades" description="Acesso por permissão e vínculo">
          <div className="text-2xl font-semibold">{units.data?.length ?? 0}</div>
        </Card>
        <button type="button" className="text-left" onClick={() => goFeedbacks()}>
          <Card title="Respostas" description={`${from} → ${to}`}>
            <div className="text-2xl font-semibold">{summary.data?.total ?? 0}</div>
          </Card>
        </button>
        <Card title="NPS" description="Promotores - Detratores">
          <div className="text-2xl font-semibold">{typeof summary.data?.nps === 'number' ? summary.data.nps : '—'}</div>
        </Card>
        <button type="button" className="text-left" onClick={() => goKanban()}>
          <Card title="Casos abertos" description="Ocorrências em andamento">
            <div className="text-2xl font-semibold">{casesSummary.data?.totals.open ?? 0}</div>
          </Card>
        </button>
      </div>

      <Card
        title="Análise de feedback"
        description={`Elogios vs reclamações no período ${from} → ${to}`}
      >
        {sentiment.isLoading && <div className="text-sm text-slate-600">Carregando...</div>}
        {sentiment.isError && <div className="text-sm text-rose-700">Falha ao carregar análise</div>}
        {sentiment.data && (
          <SentimentAnalysis
            data={sentiment.data}
            onSelectSentiment={(label) => goFeedbacks({ sentiment: label })}
            onSelectTheme={(theme, sentiment) =>
              goFeedbacks(sentiment ? { theme, sentiment } : { theme })
            }
          />
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <button type="button" className="text-left" onClick={() => goKanban({ due: 'overdue' })}>
          <Card title="Vencidos" description="Casos abertos com prazo estourado">
            <div className="text-2xl font-semibold">{casesSummary.data?.due.overdue ?? 0}</div>
          </Card>
        </button>
        <button type="button" className="text-left" onClick={() => goKanban({ due: 'today' })}>
          <Card title="Vencem hoje" description="Casos abertos com prazo hoje">
            <div className="text-2xl font-semibold">{casesSummary.data?.due.today ?? 0}</div>
          </Card>
        </button>
        <button type="button" className="text-left" onClick={() => goKanban({ due: 'next7' })}>
          <Card title="Próx. 7 dias" description="Casos abertos vencendo em breve">
            <div className="text-2xl font-semibold">{casesSummary.data?.due.next7 ?? 0}</div>
          </Card>
        </button>
        <button type="button" className="text-left" onClick={() => goKanban({ assignee: 'unassigned' })}>
          <Card title="Sem responsável" description="Casos abertos não atribuídos">
            <div className="text-2xl font-semibold">{casesSummary.data?.assignees.unassigned ?? 0}</div>
          </Card>
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Tendência de NPS" description={`${from} → ${to}`}>
          {byDay.isLoading && <div className="text-sm text-slate-600">Carregando...</div>}
          {byDay.isError && <div className="text-sm text-rose-700">Falha ao carregar</div>}
          {byDay.data && (
            <button type="button" className="block w-full text-left" onClick={() => goFeedbacks()}>
              <NpsLine points={byDay.data.points} />
            </button>
          )}
        </Card>

        <Card title="Distribuição NPS" description="Promotores / Passivos / Detratores">
          {summary.isLoading && <div className="text-sm text-slate-600">Carregando...</div>}
          {summary.isError && <div className="text-sm text-rose-700">Falha ao carregar</div>}
          {summary.data && (
            <NpsDistribution
              summary={summary.data}
              onSelect={(cls) => {
                goFeedbacks({ npsClass: cls });
              }}
            />
          )}
        </Card>

        <Card title="Fila operacional" description="Atribuição e prazos">
          {casesSummary.isLoading && <div className="text-sm text-slate-600">Carregando...</div>}
          {casesSummary.isError && <div className="text-sm text-rose-700">Falha ao carregar</div>}
          {casesSummary.data && <CasesQuickStats data={casesSummary.data} />}
        </Card>
      </div>

      {!unitId && (
        <Card title="NPS por unidade" description={`${from} → ${to}`}>
          {byUnit.isLoading && <div className="text-sm text-slate-600">Carregando...</div>}
          {byUnit.isError && <div className="text-sm text-rose-700">Falha ao carregar</div>}
          {byUnit.data && (
            <div className="overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Unidade</th>
                    <th className="py-2 pr-3 font-medium">Respostas</th>
                    <th className="py-2 pr-3 font-medium">NPS</th>
                    <th className="py-2 pr-3 font-medium">Prom.</th>
                    <th className="py-2 pr-3 font-medium">Detr.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {byUnit.data.units.map((row) => (
                    <tr
                      key={row.unitId ?? 'none'}
                      className={row.unitId ? 'cursor-pointer hover:bg-slate-50' : ''}
                      onClick={() => {
                        if (!row.unitId) return;
                        setUnitId(row.unitId);
                        setFiltersOpen(true);
                      }}
                    >
                      <td className="py-2 pr-3">{row.unitName ?? '—'}</td>
                      <td className="py-2 pr-3">{row.total}</td>
                      <td className="py-2 pr-3">{typeof row.nps === 'number' ? row.nps : '—'}</td>
                      <td className="py-2 pr-3">{row.promoters}</td>
                      <td className="py-2 pr-3">{row.detractors}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function SentimentAnalysis(props: {
  data: SentimentSummary;
  onSelectSentiment?: (label: keyof SentimentCounts) => void;
  onSelectTheme?: (theme: string, sentiment?: keyof SentimentCounts) => void;
}) {
  const data = props.data;
  const classified = data.classified;
  const empty = classified === 0;

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <SentimentStat
          label={sentimentLabel('elogio')}
          value={data.counts.elogio}
          percent={data.percents.elogio}
          colorClass="text-emerald-600"
          barClass="bg-emerald-500"
          onClick={props.onSelectSentiment ? () => props.onSelectSentiment!('elogio') : undefined}
        />
        <SentimentStat
          label={sentimentLabel('reclamacao')}
          value={data.counts.reclamacao}
          percent={data.percents.reclamacao}
          colorClass="text-rose-600"
          barClass="bg-rose-500"
          onClick={props.onSelectSentiment ? () => props.onSelectSentiment!('reclamacao') : undefined}
        />
        <SentimentStat
          label={sentimentLabel('neutro')}
          value={data.counts.neutro}
          percent={data.percents.neutro}
          colorClass="text-slate-600"
          barClass="bg-slate-500"
          onClick={props.onSelectSentiment ? () => props.onSelectSentiment!('neutro') : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid gap-3">
          <div className="text-sm font-medium text-slate-900">Composição</div>
          {empty ? (
            <div className="text-sm text-slate-600">Sem respostas classificadas no período</div>
          ) : (
            <SentimentDonut
              counts={data.counts}
              percents={data.percents}
              classified={classified}
              onSelect={props.onSelectSentiment}
            />
          )}
        </div>

        <div className="grid gap-3">
          <div className="text-sm font-medium text-slate-900">Temas mais citados</div>
          {data.byTheme.length === 0 ? (
            <div className="text-sm text-slate-600">Nenhum tema extraído ainda</div>
          ) : (
            <div className="grid gap-2">
              {data.byTheme.slice(0, 8).map((row) => (
                <ThemeBar
                  key={row.theme}
                  row={row}
                  max={data.byTheme[0]?.total || 1}
                  onSelect={props.onSelectTheme}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>
          {data.classified} classificadas de {data.responses} respostas
          {data.unclassified > 0 ? ` · ${data.unclassified} aguardando análise` : ''}
        </span>
        {!data.groqConfigured && (
          <span>GROQ_API_KEY não configurada — notas sem comentário usam o NPS</span>
        )}
      </div>
    </div>
  );
}

function SentimentStat(props: {
  label: string;
  value: number;
  percent: number;
  colorClass: string;
  barClass: string;
  onClick?: () => void;
}) {
  const content = (
    <div
      className={[
        'grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4',
        props.onClick ? 'transition-colors hover:border-slate-300 hover:bg-white hover:shadow-sm' : '',
      ].join(' ')}
    >
      <div className="text-sm text-slate-600">{props.label}</div>
      <div className="flex items-baseline gap-2">
        <div className={['text-2xl font-semibold', props.colorClass].join(' ')}>{props.value}</div>
        <div className="text-sm text-slate-500">{props.percent}%</div>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white">
        <div className={['h-full', props.barClass].join(' ')} style={{ width: `${props.percent}%` }} />
      </div>
    </div>
  );

  if (!props.onClick) return content;

  return (
    <button type="button" className="w-full text-left" onClick={props.onClick}>
      {content}
    </button>
  );
}

function SentimentDonut(props: {
  counts: SentimentCounts;
  percents: SentimentCounts;
  classified: number;
  onSelect?: (label: keyof SentimentCounts) => void;
}) {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const segments: Array<{ key: keyof SentimentCounts; color: string }> = [
    { key: 'elogio', color: '#10b981' },
    { key: 'reclamacao', color: '#f43f5e' },
    { key: 'neutro', color: '#64748b' },
  ];
  let offset = 0;
  const arcs = segments.map((seg) => {
    const fraction = props.classified > 0 ? props.counts[seg.key] / props.classified : 0;
    const length = fraction * circumference;
    const dashOffset = -offset;
    offset += length;
    return { ...seg, length, dashOffset, fraction };
  });

  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg viewBox="0 0 48 48" className="h-28 w-28 shrink-0">
        <circle cx="24" cy="24" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="7" />
        {arcs.map((arc) =>
          arc.length > 0 ? (
            <circle
              key={arc.key}
              cx="24"
              cy="24"
              r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth="7"
              strokeDasharray={`${arc.length} ${circumference - arc.length}`}
              strokeDashoffset={arc.dashOffset}
              strokeLinecap="butt"
              transform="rotate(-90 24 24)"
              pointerEvents="stroke"
              className={props.onSelect ? 'cursor-pointer hover:opacity-80' : undefined}
              onClick={props.onSelect ? () => props.onSelect!(arc.key) : undefined}
            >
              <title>{sentimentLabel(arc.key)}</title>
            </circle>
          ) : null,
        )}
      </svg>
      <div className="grid gap-1.5 text-sm">
        {segments.map((seg) => {
          const row = (
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: seg.color }} />
              <span className="text-slate-700">{sentimentLabel(seg.key)}</span>
              <span className="text-slate-500">
                {props.counts[seg.key]} ({props.percents[seg.key]}%)
              </span>
            </div>
          );
          if (!props.onSelect) return <div key={seg.key}>{row}</div>;
          return (
            <button
              key={seg.key}
              type="button"
              className="rounded-md px-1 py-0.5 text-left hover:bg-slate-50"
              onClick={() => props.onSelect!(seg.key)}
            >
              {row}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ThemeBar(props: {
  row: SentimentThemeRow;
  max: number;
  onSelect?: (theme: string, sentiment?: keyof SentimentCounts) => void;
}) {
  const width = props.max > 0 ? Math.round((props.row.total / props.max) * 100) : 0;
  const elogioPct = props.row.total > 0 ? (props.row.elogio / props.row.total) * 100 : 0;
  const reclamacaoPct = props.row.total > 0 ? (props.row.reclamacao / props.row.total) * 100 : 0;
  const neutroPct = props.row.total > 0 ? (props.row.neutro / props.row.total) * 100 : 0;
  const segments: Array<{ key: keyof SentimentCounts; pct: number; colorClass: string }> = [
    { key: 'elogio', pct: elogioPct, colorClass: 'bg-emerald-500' },
    { key: 'reclamacao', pct: reclamacaoPct, colorClass: 'bg-rose-500' },
    { key: 'neutro', pct: neutroPct, colorClass: 'bg-slate-500' },
  ];

  const label = (
    <div className="flex items-center justify-between gap-3 text-sm">
      <div className="font-medium text-slate-900">{sentimentThemeLabel(props.row.theme)}</div>
      <div className="text-slate-600">{props.row.total}</div>
    </div>
  );

  return (
    <div className="grid gap-1">
      {props.onSelect ? (
        <button type="button" className="w-full rounded-md text-left hover:bg-slate-50" onClick={() => props.onSelect!(props.row.theme)}>
          {label}
        </button>
      ) : (
        label
      )}
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100" style={{ maxWidth: `${Math.max(width, 12)}%` }}>
        {segments.map((seg) =>
          seg.pct > 0 ? (
            props.onSelect ? (
              <button
                key={seg.key}
                type="button"
                title={`${sentimentLabel(seg.key)} · ${sentimentThemeLabel(props.row.theme)}`}
                className={['block h-full min-h-0 min-w-0 border-0 p-0 hover:opacity-80', seg.colorClass].join(' ')}
                style={{ width: `${seg.pct}%` }}
                onClick={() => props.onSelect!(props.row.theme, seg.key)}
              />
            ) : (
              <div key={seg.key} className={['h-full', seg.colorClass].join(' ')} style={{ width: `${seg.pct}%` }} />
            )
          ) : null,
        )}
      </div>
    </div>
  );
}

function NpsLine(props: { points: NpsByDayPoint[] }) {
  const points = props.points;
  if (!points.length) return <div className="text-sm text-slate-600">Sem dados</div>;

  const width = 100;
  const height = 32;
  const padX = 3;
  const padY = 4;

  const values = points.map((p) => (typeof p.nps === 'number' ? p.nps : 0));
  const min = -100;
  const max = 100;

  const xAt = (i: number) => {
    if (values.length === 1) return width / 2;
    return padX + (i / (values.length - 1)) * (width - padX * 2);
  };
  const yAt = (v: number) => {
    const ratio = (max - v) / (max - min);
    return padY + ratio * (height - padY * 2);
  };

  const polyline = values.map((v, i) => `${xAt(i).toFixed(2)},${yAt(v).toFixed(2)}`).join(' ');
  const baselineY = yAt(0);
  const last = points[points.length - 1];
  const lastNps = typeof last.nps === 'number' ? last.nps : null;

  return (
    <div className="grid gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-2xl font-semibold">{typeof lastNps === 'number' ? lastNps : '—'}</div>
        <div className="text-xs text-slate-500">{points[0].date} → {last.date}</div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-24 w-full">
          <line x1="0" x2={String(width)} y1={String(baselineY)} y2={String(baselineY)} stroke="#cbd5e1" strokeWidth="0.7" />
          <polyline points={polyline} fill="none" stroke="#0284c7" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

function NpsDistribution(props: { summary: NpsSummary; onSelect?: (npsClass: 'promoter' | 'passive' | 'detractor') => void }) {
  const total = props.summary.total || 0;
  const p = props.summary.promoters;
  const pa = props.summary.passives;
  const d = props.summary.detractors;

  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);

  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <BarRow label="Promotores" value={p} percent={pct(p)} colorClass="bg-emerald-500" onClick={props.onSelect ? () => props.onSelect!('promoter') : undefined} />
        <BarRow label="Passivos" value={pa} percent={pct(pa)} colorClass="bg-slate-500" onClick={props.onSelect ? () => props.onSelect!('passive') : undefined} />
        <BarRow label="Detratores" value={d} percent={pct(d)} colorClass="bg-rose-500" onClick={props.onSelect ? () => props.onSelect!('detractor') : undefined} />
      </div>
      <div className="text-xs text-slate-500">Total: {total}</div>
    </div>
  );
}

function BarRow(props: { label: string; value: number; percent: number; colorClass: string; onClick?: () => void }) {
  const content = (
    <div className="grid gap-1">
      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="font-medium text-slate-900">{props.label}</div>
        <div className="text-slate-600">
          {props.value} ({props.percent}%)
        </div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={['h-full', props.colorClass].join(' ')} style={{ width: `${props.percent}%` }} />
      </div>
    </div>
  );

  if (!props.onClick) return content;

  return (
    <button type="button" className="text-left" onClick={props.onClick}>
      {content}
    </button>
  );
}

function CasesQuickStats(props: { data: CasesSummary }) {
  const data = props.data;
  return (
    <div className="grid gap-2 text-sm">
      <div className="flex items-center justify-between">
        <div className="text-slate-600">Abertos</div>
        <div className="font-medium text-slate-900">{data.totals.open}</div>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-slate-600">Encerrados</div>
        <div className="font-medium text-slate-900">{data.totals.closed}</div>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-slate-600">Sem prazo</div>
        <div className="font-medium text-slate-900">{data.due.noDue}</div>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-slate-600">Atribuídos</div>
        <div className="font-medium text-slate-900">{data.assignees.assigned}</div>
      </div>
    </div>
  );
}
