import { calculateNps } from './nps';

export const OPEN_CASE_STATUSES = [
  'new',
  'viewed',
  'in_progress',
  'waiting_customer',
] as const;

export const CLOSED_CASE_STATUSES = [
  'resolved',
  'closed',
  'dismissed',
] as const;

export type RankingUnitInfo = { id: string; name: string };

export type RankingCaseFields = {
  status: string;
  assigneeUserId: string | null;
  dueAt: Date | null;
  firstActionAt: Date | null;
  firstViewedAt: Date | null;
  resolvedAt: Date | null;
  createdAt: Date;
};

export type RankingResponseRow = {
  unitId: string | null;
  npsScore: number | null;
  npsClass: string | null;
  sentiment: string | null;
  completedAt: Date | null;
  startedAt?: Date | null;
  feedbackCase: RankingCaseFields | null;
};

export type RankingCaseRow = RankingCaseFields & {
  unitId: string | null;
};

export type RankingReviewRow = {
  unitId: string | null;
  rating: number;
};

export type SentimentMix = {
  elogio: number;
  reclamacao: number;
  neutro: number;
  classified: number;
  percents: {
    elogio: number;
    reclamacao: number;
    neutro: number;
  };
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

export type CaseSnapshotStats = {
  opened: number;
  closed: number;
  open: number;
  overdue: number;
  unassigned: number;
};

export type ReviewSnapshotStats = {
  averageRating: number | null;
  totalReviews: number;
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
  cases: CaseSnapshotStats;
  reviews: ReviewSnapshotStats;
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

const NONE_KEY = '__none__';

export function isOpenCaseStatus(status: string): boolean {
  return (OPEN_CASE_STATUSES as readonly string[]).includes(status);
}

export function isClosedCaseStatus(status: string): boolean {
  return (CLOSED_CASE_STATUSES as readonly string[]).includes(status);
}

export function isDetractor(
  npsClass: string | null | undefined,
  npsScore: number | null | undefined,
): boolean {
  if (npsClass === 'detractor') return true;
  if (npsClass === 'promoter' || npsClass === 'passive') return false;
  return (
    typeof npsScore === 'number' && Number.isFinite(npsScore) && npsScore <= 6
  );
}

export function monthKeyUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthKeysInRange(from: Date, to: Date): string[] {
  const keys: string[] = [];
  const cursor = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1),
  );
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  while (cursor.getTime() <= end.getTime()) {
    keys.push(monthKeyUtc(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return keys;
}

export function percent(part: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((part / total) * 100);
}

export function roundHours(value: number): number {
  return Math.round(value * 10) / 10;
}

export function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function hoursBetween(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
}

function emptyTreatment(): TreatmentStats {
  return {
    detractors: 0,
    withCase: 0,
    withoutCase: 0,
    caseOpen: 0,
    caseClosed: 0,
    caseOverdue: 0,
    caseUnassigned: 0,
    withCasePct: null,
    resolvedOfCasesPct: null,
    resolvedOfDetractorsPct: null,
    onTimePct: null,
    avgHoursToFirstAction: null,
    medianHoursToFirstAction: null,
    avgHoursToClose: null,
    medianHoursToClose: null,
  };
}

function emptyCases(): CaseSnapshotStats {
  return { opened: 0, closed: 0, open: 0, overdue: 0, unassigned: 0 };
}

function emptyReviews(): ReviewSnapshotStats {
  return { averageRating: null, totalReviews: 0 };
}

function emptyMonthlyPoint(month: string): RankingMonthlyPoint {
  return {
    month,
    total: 0,
    promoters: 0,
    passives: 0,
    detractors: 0,
    nps: null,
    sentiment: { elogio: 0, reclamacao: 0, neutro: 0 },
    treatment: {
      detractors: 0,
      withCase: 0,
      caseOpen: 0,
      caseClosed: 0,
      withoutCase: 0,
      withCasePct: null,
      resolvedOfDetractorsPct: null,
      resolvedOfCasesPct: null,
    },
    casesOpened: 0,
    casesResolved: 0,
  };
}

function unitKey(unitId: string | null | undefined): string {
  return unitId ?? NONE_KEY;
}

function compareRank(
  a: { nps: number | null; total: number; unitName: string },
  b: { nps: number | null; total: number; unitName: string },
): number {
  const aNps = a.nps;
  const bNps = b.nps;
  if (aNps === null && bNps !== null) return 1;
  if (aNps !== null && bNps === null) return -1;
  if (aNps !== null && bNps !== null && aNps !== bNps) return bNps - aNps;
  if (a.total !== b.total) return b.total - a.total;
  return a.unitName.localeCompare(b.unitName, 'pt-BR');
}

function compareTreatmentRank(
  a: RankingUnitSnapshot,
  b: RankingUnitSnapshot,
): number {
  const aRate = a.treatment.resolvedOfDetractorsPct;
  const bRate = b.treatment.resolvedOfDetractorsPct;
  if (aRate === null && bRate !== null) return 1;
  if (aRate !== null && bRate === null) return -1;
  if (aRate !== null && bRate !== null && aRate !== bRate) return bRate - aRate;
  const aWith = a.treatment.withCasePct;
  const bWith = b.treatment.withCasePct;
  if (aWith === null && bWith !== null) return 1;
  if (aWith !== null && bWith === null) return -1;
  if (aWith !== null && bWith !== null && aWith !== bWith) return bWith - aWith;
  if (a.treatment.detractors !== b.treatment.detractors) {
    return b.treatment.detractors - a.treatment.detractors;
  }
  return a.unitName.localeCompare(b.unitName, 'pt-BR');
}

type UnitBucket = {
  unitId: string | null;
  unitName: string;
  scores: number[];
  sentiment: { elogio: number; reclamacao: number; neutro: number };
  detractorResponses: RankingResponseRow[];
  casesCreated: RankingCaseRow[];
  reviewRatings: number[];
};

function sentimentMixFromCounts(counts: {
  elogio: number;
  reclamacao: number;
  neutro: number;
}): SentimentMix {
  const classified = counts.elogio + counts.reclamacao + counts.neutro;
  return {
    elogio: counts.elogio,
    reclamacao: counts.reclamacao,
    neutro: counts.neutro,
    classified,
    percents: {
      elogio: percent(counts.elogio, classified) ?? 0,
      reclamacao: percent(counts.reclamacao, classified) ?? 0,
      neutro: percent(counts.neutro, classified) ?? 0,
    },
  };
}

function isOverdue(params: {
  status: string;
  dueAt: Date | null;
  nowStart: Date;
}): boolean {
  if (!isOpenCaseStatus(params.status)) return false;
  if (!params.dueAt) return false;
  return params.dueAt.getTime() < params.nowStart.getTime();
}

export function buildTreatmentStats(
  detractorResponses: RankingResponseRow[],
  nowStart: Date,
): TreatmentStats {
  const stats = emptyTreatment();
  stats.detractors = detractorResponses.length;
  const firstActionHours: number[] = [];
  const closeHours: number[] = [];
  let onTimeClosed = 0;
  let closedWithDue = 0;

  for (const row of detractorResponses) {
    const fb = row.feedbackCase;
    if (!fb) {
      stats.withoutCase += 1;
      continue;
    }
    stats.withCase += 1;
    if (isOpenCaseStatus(fb.status)) {
      stats.caseOpen += 1;
      if (!fb.assigneeUserId) stats.caseUnassigned += 1;
      if (isOverdue({ status: fb.status, dueAt: fb.dueAt, nowStart })) {
        stats.caseOverdue += 1;
      }
    } else if (isClosedCaseStatus(fb.status)) {
      stats.caseClosed += 1;
      if (fb.dueAt && fb.resolvedAt) {
        closedWithDue += 1;
        if (fb.resolvedAt.getTime() <= fb.dueAt.getTime()) onTimeClosed += 1;
      }
    }

    const firstAt = fb.firstActionAt ?? fb.firstViewedAt;
    if (firstAt) firstActionHours.push(hoursBetween(fb.createdAt, firstAt));
    if (fb.resolvedAt)
      closeHours.push(hoursBetween(fb.createdAt, fb.resolvedAt));
  }

  stats.withCasePct = percent(stats.withCase, stats.detractors);
  stats.resolvedOfCasesPct = percent(stats.caseClosed, stats.withCase);
  stats.resolvedOfDetractorsPct = percent(stats.caseClosed, stats.detractors);
  stats.onTimePct = percent(onTimeClosed, closedWithDue);
  stats.avgHoursToFirstAction =
    average(firstActionHours) !== null
      ? roundHours(average(firstActionHours)!)
      : null;
  stats.medianHoursToFirstAction =
    median(firstActionHours) !== null
      ? roundHours(median(firstActionHours)!)
      : null;
  stats.avgHoursToClose =
    average(closeHours) !== null ? roundHours(average(closeHours)!) : null;
  stats.medianHoursToClose =
    median(closeHours) !== null ? roundHours(median(closeHours)!) : null;
  return stats;
}

function caseSnapshotFromRows(
  rows: RankingCaseRow[],
  nowStart: Date,
): CaseSnapshotStats {
  const stats = emptyCases();
  stats.opened = rows.length;
  for (const row of rows) {
    if (isClosedCaseStatus(row.status)) stats.closed += 1;
    if (isOpenCaseStatus(row.status)) {
      stats.open += 1;
      if (!row.assigneeUserId) stats.unassigned += 1;
      if (isOverdue({ status: row.status, dueAt: row.dueAt, nowStart }))
        stats.overdue += 1;
    }
  }
  return stats;
}

function reviewSnapshot(ratings: number[]): ReviewSnapshotStats {
  if (!ratings.length) return emptyReviews();
  const avg = ratings.reduce((sum, v) => sum + v, 0) / ratings.length;
  return {
    averageRating: Number(avg.toFixed(1)),
    totalReviews: ratings.length,
  };
}

function snapshotFromBucket(
  bucket: UnitBucket,
  nowStart: Date,
): RankingUnitSnapshot {
  const nps = calculateNps(bucket.scores);
  return {
    rank: 0,
    unitId: bucket.unitId,
    unitName: bucket.unitName,
    total: nps.total,
    promoters: nps.promoters,
    passives: nps.passives,
    detractors: nps.detractors,
    nps: nps.nps,
    promoterPct: percent(nps.promoters, nps.total),
    passivePct: percent(nps.passives, nps.total),
    detractorPct: percent(nps.detractors, nps.total),
    sentiment: sentimentMixFromCounts(bucket.sentiment),
    treatment: buildTreatmentStats(bucket.detractorResponses, nowStart),
    cases: caseSnapshotFromRows(bucket.casesCreated, nowStart),
    reviews: reviewSnapshot(bucket.reviewRatings),
  };
}

function createBucket(unitId: string | null, unitName: string): UnitBucket {
  return {
    unitId,
    unitName,
    scores: [],
    sentiment: { elogio: 0, reclamacao: 0, neutro: 0 },
    detractorResponses: [],
    casesCreated: [],
    reviewRatings: [],
  };
}

function ensureBucket(
  buckets: Map<string, UnitBucket>,
  unitId: string | null,
  unitName: string,
): UnitBucket {
  const key = unitKey(unitId);
  const existing = buckets.get(key);
  if (existing) return existing;
  const created = createBucket(unitId, unitName);
  buckets.set(key, created);
  return created;
}

export function buildRankingSnapshot(params: {
  units: RankingUnitInfo[];
  responses: RankingResponseRow[];
  cases: RankingCaseRow[];
  reviews: RankingReviewRow[];
  now: Date;
}): { units: RankingUnitSnapshot[]; totals: RankingUnitSnapshot } {
  const nowStart = new Date(
    Date.UTC(
      params.now.getUTCFullYear(),
      params.now.getUTCMonth(),
      params.now.getUTCDate(),
    ),
  );
  const buckets = new Map<string, UnitBucket>();

  for (const unit of params.units) {
    buckets.set(unit.id, createBucket(unit.id, unit.name));
  }

  const nameById = new Map(params.units.map((u) => [u.id, u.name]));

  for (const row of params.responses) {
    const id = row.unitId;
    const name = id ? (nameById.get(id) ?? 'Unidade') : 'Sem unidade';
    const bucket = ensureBucket(buckets, id, name);
    if (typeof row.npsScore === 'number') bucket.scores.push(row.npsScore);
    if (
      row.sentiment === 'elogio' ||
      row.sentiment === 'reclamacao' ||
      row.sentiment === 'neutro'
    ) {
      bucket.sentiment[row.sentiment] += 1;
    }
    if (isDetractor(row.npsClass, row.npsScore))
      bucket.detractorResponses.push(row);
  }

  for (const row of params.cases) {
    const id = row.unitId;
    const name = id ? (nameById.get(id) ?? 'Unidade') : 'Sem unidade';
    const bucket = ensureBucket(buckets, id, name);
    bucket.casesCreated.push(row);
  }

  for (const row of params.reviews) {
    const id = row.unitId;
    const name = id ? (nameById.get(id) ?? 'Unidade') : 'Sem unidade';
    const bucket = ensureBucket(buckets, id, name);
    bucket.reviewRatings.push(row.rating);
  }

  const units = Array.from(buckets.values()).map((bucket) =>
    snapshotFromBucket(bucket, nowStart),
  );
  units.sort(compareRank);
  units.forEach((row, index) => {
    row.rank = index + 1;
  });

  const totalsBucket = createBucket(null, 'Todas');
  for (const bucket of buckets.values()) {
    totalsBucket.scores.push(...bucket.scores);
    totalsBucket.sentiment.elogio += bucket.sentiment.elogio;
    totalsBucket.sentiment.reclamacao += bucket.sentiment.reclamacao;
    totalsBucket.sentiment.neutro += bucket.sentiment.neutro;
    totalsBucket.detractorResponses.push(...bucket.detractorResponses);
    totalsBucket.casesCreated.push(...bucket.casesCreated);
    totalsBucket.reviewRatings.push(...bucket.reviewRatings);
  }
  const totals = snapshotFromBucket(totalsBucket, nowStart);
  totals.unitId = null;
  totals.unitName = 'Todas';

  return { units, totals };
}

export function sortUnitsByTreatment(
  units: RankingUnitSnapshot[],
): RankingUnitSnapshot[] {
  return [...units].sort(compareTreatmentRank);
}

export function buildRankingMonthly(params: {
  units: RankingUnitInfo[];
  responses: RankingResponseRow[];
  cases: RankingCaseRow[];
  from: Date;
  to: Date;
}): { months: string[]; series: RankingMonthlySeries[] } {
  const months = monthKeysInRange(params.from, params.to);
  const nameById = new Map(params.units.map((u) => [u.id, u.name]));
  const seriesMap = new Map<string, RankingMonthlySeries>();

  const emptyPoints = (): RankingMonthlyPoint[] =>
    months.map((month) => emptyMonthlyPoint(month));

  const ensureSeries = (
    unitId: string | null,
    unitName: string,
  ): RankingMonthlySeries => {
    const key = unitKey(unitId);
    const existing = seriesMap.get(key);
    if (existing) return existing;
    const created: RankingMonthlySeries = {
      unitId,
      unitName,
      points: emptyPoints(),
    };
    seriesMap.set(key, created);
    return created;
  };

  for (const unit of params.units) {
    ensureSeries(unit.id, unit.name);
  }

  const pointIndex = new Map(months.map((month, i) => [month, i]));

  type Acc = {
    scores: number[];
    sentiment: { elogio: number; reclamacao: number; neutro: number };
    detractors: number;
    withCase: number;
    caseOpen: number;
    caseClosed: number;
    casesOpened: number;
    casesResolved: number;
  };

  const accByKey = new Map<string, Acc[]>();

  const ensureAcc = (unitId: string | null): Acc[] => {
    const key = unitKey(unitId);
    const existing = accByKey.get(key);
    if (existing) return existing;
    const created = months.map(() => ({
      scores: [] as number[],
      sentiment: { elogio: 0, reclamacao: 0, neutro: 0 },
      detractors: 0,
      withCase: 0,
      caseOpen: 0,
      caseClosed: 0,
      casesOpened: 0,
      casesResolved: 0,
    }));
    accByKey.set(key, created);
    return created;
  };

  for (const unit of params.units) ensureAcc(unit.id);

  for (const row of params.responses) {
    const at = row.completedAt ?? row.startedAt;
    if (!at) continue;
    const month = monthKeyUtc(at);
    const idx = pointIndex.get(month);
    if (idx === undefined) continue;
    const id = row.unitId;
    const name = id ? (nameById.get(id) ?? 'Unidade') : 'Sem unidade';
    ensureSeries(id, name);
    const acc = ensureAcc(id);
    const cell = acc[idx];
    if (typeof row.npsScore === 'number' && Number.isFinite(row.npsScore)) {
      cell.scores.push(row.npsScore);
    }
    if (
      row.sentiment === 'elogio' ||
      row.sentiment === 'reclamacao' ||
      row.sentiment === 'neutro'
    ) {
      cell.sentiment[row.sentiment] += 1;
    }
    if (isDetractor(row.npsClass, row.npsScore)) {
      cell.detractors += 1;
      if (row.feedbackCase) {
        cell.withCase += 1;
        if (isOpenCaseStatus(row.feedbackCase.status)) cell.caseOpen += 1;
        if (isClosedCaseStatus(row.feedbackCase.status)) cell.caseClosed += 1;
      }
    }
  }

  for (const row of params.cases) {
    const id = row.unitId;
    const name = id ? (nameById.get(id) ?? 'Unidade') : 'Sem unidade';
    ensureSeries(id, name);
    const acc = ensureAcc(id);
    const openedMonth = monthKeyUtc(row.createdAt);
    const openedIdx = pointIndex.get(openedMonth);
    if (openedIdx !== undefined) acc[openedIdx].casesOpened += 1;
    if (row.resolvedAt) {
      const resolvedMonth = monthKeyUtc(row.resolvedAt);
      const resolvedIdx = pointIndex.get(resolvedMonth);
      if (resolvedIdx !== undefined) acc[resolvedIdx].casesResolved += 1;
    }
  }

  const series: RankingMonthlySeries[] = [];
  for (const [key, serie] of seriesMap) {
    const acc = accByKey.get(key) ?? ensureAcc(serie.unitId);
    serie.points = months.map((month, idx) => {
      const cell = acc[idx];
      const nps = calculateNps(cell.scores);
      const withoutCase = Math.max(0, cell.detractors - cell.withCase);
      return {
        month,
        total: nps.total,
        promoters: nps.promoters,
        passives: nps.passives,
        detractors: nps.detractors,
        nps: nps.nps,
        sentiment: { ...cell.sentiment },
        treatment: {
          detractors: cell.detractors,
          withCase: cell.withCase,
          caseOpen: cell.caseOpen,
          caseClosed: cell.caseClosed,
          withoutCase,
          withCasePct: percent(cell.withCase, cell.detractors),
          resolvedOfDetractorsPct: percent(cell.caseClosed, cell.detractors),
          resolvedOfCasesPct: percent(cell.caseClosed, cell.withCase),
        },
        casesOpened: cell.casesOpened,
        casesResolved: cell.casesResolved,
      };
    });
    series.push(serie);
  }

  series.sort((a, b) => {
    const aLatest =
      [...a.points].reverse().find((p) => p.nps !== null)?.nps ?? null;
    const bLatest =
      [...b.points].reverse().find((p) => p.nps !== null)?.nps ?? null;
    const aTotal = a.points.reduce((sum, p) => sum + p.total, 0);
    const bTotal = b.points.reduce((sum, p) => sum + p.total, 0);
    return compareRank(
      { nps: aLatest, total: aTotal, unitName: a.unitName },
      { nps: bLatest, total: bTotal, unitName: b.unitName },
    );
  });

  return { months, series };
}
