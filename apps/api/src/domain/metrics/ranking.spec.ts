import {
  buildRankingMonthly,
  buildRankingSnapshot,
  buildTreatmentStats,
  isDetractor,
  monthKeysInRange,
  sortUnitsByTreatment,
  type RankingCaseRow,
  type RankingResponseRow,
} from './ranking';

function at(iso: string): Date {
  return new Date(iso);
}

function response(
  overrides: Partial<RankingResponseRow> & { npsScore: number },
): RankingResponseRow {
  return {
    unitId: 'u1',
    npsClass: null,
    sentiment: null,
    completedAt: at('2026-03-15T12:00:00.000Z'),
    feedbackCase: null,
    ...overrides,
  };
}

function fbCase(overrides: Partial<RankingCaseRow> = {}): RankingCaseRow {
  return {
    unitId: 'u1',
    status: 'new',
    assigneeUserId: null,
    dueAt: null,
    firstActionAt: null,
    firstViewedAt: null,
    resolvedAt: null,
    createdAt: at('2026-03-15T12:00:00.000Z'),
    ...overrides,
  };
}

describe('ranking aggregations', () => {
  it('treats NPS 0-6 as detractors when npsClass is missing', () => {
    expect(isDetractor(null, 6)).toBe(true);
    expect(isDetractor('detractor', 9)).toBe(true);
    expect(isDetractor('promoter', 6)).toBe(false);
    expect(isDetractor('passive', 7)).toBe(false);
  });

  it('includes every calendar month in the range, even empty ones', () => {
    expect(
      monthKeysInRange(
        at('2026-01-15T00:00:00.000Z'),
        at('2026-03-10T23:59:59.999Z'),
      ),
    ).toEqual(['2026-01', '2026-02', '2026-03']);
  });

  it('ranks units by NPS descending, then by more responses, then by name', () => {
    const { units } = buildRankingSnapshot({
      now: at('2026-03-20T00:00:00.000Z'),
      units: [
        { id: 'a', name: 'Alpha' },
        { id: 'b', name: 'Beta' },
        { id: 'c', name: 'Gama' },
        { id: 'd', name: 'Delta' },
      ],
      responses: [
        response({ unitId: 'a', npsScore: 10, npsClass: 'promoter' }),
        response({ unitId: 'a', npsScore: 9, npsClass: 'promoter' }),
        response({ unitId: 'b', npsScore: 10, npsClass: 'promoter' }),
        response({ unitId: 'b', npsScore: 0, npsClass: 'detractor' }),
        response({ unitId: 'c', npsScore: 10, npsClass: 'promoter' }),
        response({ unitId: 'c', npsScore: 9, npsClass: 'promoter' }),
        response({ unitId: 'c', npsScore: 9, npsClass: 'promoter' }),
      ],
      cases: [],
      reviews: [],
    });

    expect(units.map((u) => u.unitId)).toEqual(['c', 'a', 'b', 'd']);
    expect(units[0].nps).toBe(100);
    expect(units[0].total).toBe(3);
    expect(units[1].nps).toBe(100);
    expect(units[1].total).toBe(2);
    expect(units[2].nps).toBe(0);
    expect(units[3].nps).toBeNull();
    expect(units[3].rank).toBe(4);
  });

  it('computes detractor treatment rates from linked FeedbackCase status', () => {
    const now = at('2026-03-20T00:00:00.000Z');
    const created = at('2026-03-10T10:00:00.000Z');
    const rows: RankingResponseRow[] = [
      response({
        npsScore: 3,
        npsClass: 'detractor',
        feedbackCase: {
          status: 'resolved',
          assigneeUserId: 'u',
          dueAt: at('2026-03-18T00:00:00.000Z'),
          firstActionAt: at('2026-03-10T16:00:00.000Z'),
          firstViewedAt: at('2026-03-10T12:00:00.000Z'),
          resolvedAt: at('2026-03-12T10:00:00.000Z'),
          createdAt: created,
        },
      }),
      response({
        npsScore: 4,
        npsClass: 'detractor',
        feedbackCase: {
          status: 'in_progress',
          assigneeUserId: null,
          dueAt: at('2026-03-01T00:00:00.000Z'),
          firstActionAt: at('2026-03-10T22:00:00.000Z'),
          firstViewedAt: at('2026-03-10T12:00:00.000Z'),
          resolvedAt: null,
          createdAt: created,
        },
      }),
      response({ npsScore: 2, npsClass: 'detractor', feedbackCase: null }),
      response({ npsScore: 1, npsClass: 'detractor', feedbackCase: null }),
      response({ npsScore: 10, npsClass: 'promoter', feedbackCase: null }),
    ];

    const stats = buildTreatmentStats(
      rows.filter((r) => isDetractor(r.npsClass, r.npsScore)),
      now,
    );

    expect(stats.detractors).toBe(4);
    expect(stats.withCase).toBe(2);
    expect(stats.withoutCase).toBe(2);
    expect(stats.caseOpen).toBe(1);
    expect(stats.caseClosed).toBe(1);
    expect(stats.caseOverdue).toBe(1);
    expect(stats.caseUnassigned).toBe(1);
    expect(stats.withCasePct).toBe(50);
    expect(stats.resolvedOfCasesPct).toBe(50);
    expect(stats.resolvedOfDetractorsPct).toBe(25);
    expect(stats.onTimePct).toBe(100);
    expect(stats.avgHoursToFirstAction).toBe(9);
    expect(stats.medianHoursToFirstAction).toBe(9);
    expect(stats.avgHoursToClose).toBe(48);
  });

  it('counts a detractor without a case as untreated', () => {
    const { units } = buildRankingSnapshot({
      now: at('2026-03-20T00:00:00.000Z'),
      units: [{ id: 'u1', name: 'Centro' }],
      responses: [
        response({ npsScore: 0, npsClass: 'detractor', feedbackCase: null }),
      ],
      cases: [],
      reviews: [],
    });
    expect(units[0].treatment.withoutCase).toBe(1);
    expect(units[0].treatment.withCasePct).toBe(0);
    expect(units[0].treatment.resolvedOfDetractorsPct).toBe(0);
  });

  it('keeps empty months as 0 responses and null NPS so the axis stays continuous', () => {
    const result = buildRankingMonthly({
      from: at('2026-01-01T00:00:00.000Z'),
      to: at('2026-03-31T23:59:59.999Z'),
      units: [{ id: 'u1', name: 'Centro' }],
      responses: [
        response({
          unitId: 'u1',
          npsScore: 10,
          npsClass: 'promoter',
          completedAt: at('2026-02-10T12:00:00.000Z'),
        }),
      ],
      cases: [
        fbCase({
          createdAt: at('2026-02-10T12:00:00.000Z'),
          resolvedAt: at('2026-03-05T12:00:00.000Z'),
          status: 'resolved',
        }),
      ],
    });

    expect(result.months).toEqual(['2026-01', '2026-02', '2026-03']);
    const points = result.series[0].points;
    expect(points[0]).toMatchObject({
      month: '2026-01',
      total: 0,
      nps: null,
      casesOpened: 0,
    });
    expect(points[1]).toMatchObject({
      month: '2026-02',
      total: 1,
      nps: 100,
      casesOpened: 1,
      casesResolved: 0,
    });
    expect(points[2]).toMatchObject({
      month: '2026-03',
      total: 0,
      nps: null,
      casesOpened: 0,
      casesResolved: 1,
    });
  });

  it('buckets monthly treatment from that month’s detractors, not from later case dates', () => {
    const result = buildRankingMonthly({
      from: at('2026-02-01T00:00:00.000Z'),
      to: at('2026-02-28T23:59:59.999Z'),
      units: [{ id: 'u1', name: 'Centro' }],
      responses: [
        response({
          npsScore: 3,
          npsClass: 'detractor',
          completedAt: at('2026-02-08T12:00:00.000Z'),
          feedbackCase: {
            status: 'resolved',
            assigneeUserId: 'u',
            dueAt: null,
            firstActionAt: null,
            firstViewedAt: null,
            resolvedAt: at('2026-03-01T00:00:00.000Z'),
            createdAt: at('2026-02-08T12:00:00.000Z'),
          },
        }),
        response({
          npsScore: 4,
          npsClass: 'detractor',
          completedAt: at('2026-02-09T12:00:00.000Z'),
          feedbackCase: null,
        }),
      ],
      cases: [],
    });

    const treatment = result.series[0].points[0].treatment;
    expect(treatment.detractors).toBe(2);
    expect(treatment.withCase).toBe(1);
    expect(treatment.withoutCase).toBe(1);
    expect(treatment.caseClosed).toBe(1);
    expect(treatment.withCasePct).toBe(50);
    expect(treatment.resolvedOfDetractorsPct).toBe(50);
  });

  it('sorts treatment ranking by % of detractors with a closed case', () => {
    const { units } = buildRankingSnapshot({
      now: at('2026-03-20T00:00:00.000Z'),
      units: [
        { id: 'low', name: 'Baixa' },
        { id: 'high', name: 'Alta' },
      ],
      responses: [
        response({
          unitId: 'high',
          npsScore: 2,
          npsClass: 'detractor',
          feedbackCase: {
            status: 'closed',
            assigneeUserId: 'u',
            dueAt: null,
            firstActionAt: null,
            firstViewedAt: null,
            resolvedAt: at('2026-03-16T00:00:00.000Z'),
            createdAt: at('2026-03-15T00:00:00.000Z'),
          },
        }),
        response({
          unitId: 'low',
          npsScore: 1,
          npsClass: 'detractor',
          feedbackCase: null,
        }),
      ],
      cases: [],
      reviews: [],
    });

    const ranked = sortUnitsByTreatment(units);
    expect(ranked.map((u) => u.unitId)).toEqual(['high', 'low']);
    expect(ranked[0].treatment.resolvedOfDetractorsPct).toBe(100);
    expect(ranked[1].treatment.resolvedOfDetractorsPct).toBe(0);
  });

  it('aggregates reviews and period cases per unit without mixing tenants-level units', () => {
    const { units, totals } = buildRankingSnapshot({
      now: at('2026-03-20T00:00:00.000Z'),
      units: [
        { id: 'u1', name: 'Centro' },
        { id: 'u2', name: 'Norte' },
      ],
      responses: [
        response({
          unitId: 'u1',
          npsScore: 9,
          npsClass: 'promoter',
          sentiment: 'elogio',
        }),
      ],
      cases: [
        fbCase({ unitId: 'u1', status: 'new' }),
        fbCase({
          unitId: 'u2',
          status: 'resolved',
          resolvedAt: at('2026-03-18T00:00:00.000Z'),
        }),
      ],
      reviews: [
        { unitId: 'u1', rating: 5 },
        { unitId: 'u1', rating: 4 },
      ],
    });

    const centro = units.find((u) => u.unitId === 'u1')!;
    const norte = units.find((u) => u.unitId === 'u2')!;
    expect(centro.reviews).toEqual({ averageRating: 4.5, totalReviews: 2 });
    expect(norte.reviews.totalReviews).toBe(0);
    expect(centro.cases.open).toBe(1);
    expect(norte.cases.closed).toBe(1);
    expect(totals.cases.opened).toBe(2);
    expect(totals.sentiment.elogio).toBe(1);
  });
});
