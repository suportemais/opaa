// Tipos das respostas de /metrics/ranking/* e utilidades do Ranking.

export type Unit = { id: string; name: string };

export type SentimentMix = {
  elogio: number;
  reclamacao: number;
  neutro: number;
  classified: number;
  percents: { elogio: number; reclamacao: number; neutro: number };
};

export type TreatmentStats = {
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

export type RankingUnitSnapshot = {
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

export type RankingSummary = {
  from: string;
  to: string;
  unitId: string | null;
  totals: RankingUnitSnapshot;
  units: RankingUnitSnapshot[];
};

export type RankingMonthlyPoint = {
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

export type RankingMonthlySeries = {
  unitId: string | null;
  unitName: string;
  points: RankingMonthlyPoint[];
};

export type RankingMonthly = { months: string[]; series: RankingMonthlySeries[] };

export type Ordem = 'nps' | 'respostas' | 'resolvidos' | 'elogios';

export const ORDENS: Record<
  Ordem,
  { nome: string; rotulo: string; valor: (u: RankingUnitSnapshot) => number | null; formato: (v: number) => string }
> = {
  nps: { nome: 'NPS', rotulo: 'NPS', valor: (u) => u.nps, formato: String },
  respostas: { nome: 'respostas', rotulo: 'respostas', valor: (u) => u.total, formato: (v) => v.toLocaleString('pt-BR') },
  resolvidos: {
    nome: 'detratores resolvidos',
    rotulo: 'detratores resolvidos',
    valor: (u) => u.treatment.resolvedOfDetractorsPct,
    formato: (v) => `${v}%`,
  },
  elogios: {
    nome: 'elogios nos comentários',
    rotulo: 'elogios',
    valor: (u) => (u.sentiment.classified > 0 ? u.sentiment.percents.elogio : null),
    formato: (v) => `${v}%`,
  },
};

/** Ordena por uma medida (vazios por último), desempatando pelo NPS e pelo nome. */
export function ordenarPor(rows: RankingUnitSnapshot[], ordem: Ordem) {
  const valor = ORDENS[ordem].valor;
  return [...rows].sort((a, b) => {
    const va = valor(a);
    const vb = valor(b);
    if (va === null && vb !== null) return 1;
    if (va !== null && vb === null) return -1;
    if (va !== null && vb !== null && va !== vb) return vb - va;
    const na = a.nps ?? -1000;
    const nb = b.nps ?? -1000;
    if (na !== nb) return nb - na;
    return a.unitName.localeCompare(b.unitName, 'pt-BR');
  });
}

export const chaveSerie = (row: { unitId: string | null }) => row.unitId ?? 'none';

export function fmtPct(value: number | null | undefined) {
  return typeof value === 'number' ? `${value}%` : '—';
}

export function fmtNps(value: number | null | undefined) {
  return typeof value === 'number' ? String(value) : '—';
}

export function fmtHoras(value: number | null | undefined) {
  if (typeof value !== 'number') return '—';
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`;
}

export function percentOf(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

export function aggregateDemais(hidden: RankingMonthlySeries[]): RankingMonthlySeries {
  const months = hidden[0]?.points.map((p) => p.month) ?? [];
  return {
    unitId: '__others__',
    unitName: 'Demais',
    points: months.map((month, idx) => {
      const pts = hidden.map((s) => s.points[idx]);
      const sum = (f: (p: RankingMonthlyPoint) => number) => pts.reduce((acc, p) => acc + f(p), 0);
      const total = sum((p) => p.total);
      const promoters = sum((p) => p.promoters);
      const passives = sum((p) => p.passives);
      const detractors = sum((p) => p.detractors);
      const nps = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : null;
      const tDetractors = sum((p) => p.treatment.detractors);
      const withCase = sum((p) => p.treatment.withCase);
      const caseOpen = sum((p) => p.treatment.caseOpen);
      const caseClosed = sum((p) => p.treatment.caseClosed);
      return {
        month,
        total,
        promoters,
        passives,
        detractors,
        nps,
        sentiment: {
          elogio: sum((p) => p.sentiment.elogio),
          reclamacao: sum((p) => p.sentiment.reclamacao),
          neutro: sum((p) => p.sentiment.neutro),
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
        casesOpened: sum((p) => p.casesOpened),
        casesResolved: sum((p) => p.casesResolved),
      };
    }),
  };
}

/** Mix de 3 partes em percentuais inteiros (para as barras rk-mix). */
export function mix3(a: number, b: number, c: number) {
  const t = a + b + c;
  if (!t) return [0, 0, 0];
  const pa = Math.round((a / t) * 100);
  const pc = Math.round((c / t) * 100);
  return [pa, Math.max(0, 100 - pa - pc), pc];
}
