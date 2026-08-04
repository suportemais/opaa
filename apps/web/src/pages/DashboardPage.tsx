import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { apiFetch } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useNavigate } from 'react-router-dom';

type Unit = { id: string; name: string };
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

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [rangeDays, setRangeDays] = useState(30);
  const [unitId, setUnitId] = useState<string>('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const units = useQuery({
    queryKey: ['units'],
    queryFn: () => apiFetch<Unit[]>('/units'),
  });

  const { from, to } = useMemo(() => {
    const now = new Date();
    const fromDate = new Date(now.getTime() - (rangeDays - 1) * 24 * 60 * 60 * 1000);
    return { from: toIsoDate(fromDate), to: toIsoDate(now) };
  }, [rangeDays]);

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
        <div className="text-xl font-semibold">Dashboard</div>
        <div className="text-sm text-slate-600">Base operacional do MVP</div>
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
                    <tr key={row.unitId ?? 'none'}>
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
