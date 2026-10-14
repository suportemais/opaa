import { calculateNps } from './nps';
import { percent } from './ranking';

export type EmployeeRankingResponseRow = {
  employeeId: string | null;
  npsScore: number | null;
  sentiment: string | null;
};

export type EmployeeRankingInfo = {
  id: string;
  name: string;
  unitId: string;
  unit?: { id: string; name: string } | null;
};

export type EmployeeRankingItem = {
  employeeId: string;
  name: string;
  unitId: string | null;
  unitName: string | null;
  /** Respostas concluídas atribuídas ao atendente no período. */
  responses: number;
  /** Percentuais sobre respostas com nota NPS (0–100, inteiro) ou null. */
  promotersPct: number | null;
  passivesPct: number | null;
  detractorsPct: number | null;
  nps: number | null;
  /** % de `elogio` entre respostas com sentimento classificado. */
  elogiosPct: number | null;
};

/**
 * Agrega respostas concluídas por atendente. Ordena por NPS desc (null por último),
 * depois por volume de respostas desc e nome.
 */
export function buildEmployeeRanking(
  rows: EmployeeRankingResponseRow[],
  employees: EmployeeRankingInfo[],
): EmployeeRankingItem[] {
  const byId = new Map(employees.map((e) => [e.id, e]));
  const buckets = new Map<
    string,
    {
      responses: number;
      scores: number[];
      withSentiment: number;
      elogios: number;
    }
  >();

  for (const r of rows) {
    if (!r.employeeId) continue;
    const b = buckets.get(r.employeeId) ?? {
      responses: 0,
      scores: [],
      withSentiment: 0,
      elogios: 0,
    };
    b.responses += 1;
    if (typeof r.npsScore === 'number') b.scores.push(r.npsScore);
    if (r.sentiment) {
      b.withSentiment += 1;
      if (r.sentiment === 'elogio') b.elogios += 1;
    }
    buckets.set(r.employeeId, b);
  }

  const items: EmployeeRankingItem[] = [];
  for (const [employeeId, b] of buckets) {
    const info = byId.get(employeeId);
    if (!info) continue; // atendente de outro tenant ou inexistente
    const nps = calculateNps(b.scores);
    items.push({
      employeeId,
      name: info.name,
      unitId: info.unit?.id ?? info.unitId ?? null,
      unitName: info.unit?.name ?? null,
      responses: b.responses,
      promotersPct: percent(nps.promoters, nps.total),
      passivesPct: percent(nps.passives, nps.total),
      detractorsPct: percent(nps.detractors, nps.total),
      nps: nps.nps,
      elogiosPct: percent(b.elogios, b.withSentiment),
    });
  }

  items.sort((a, b) => {
    const an = a.nps ?? -Infinity;
    const bn = b.nps ?? -Infinity;
    if (an !== bn) return bn - an;
    if (a.responses !== b.responses) return b.responses - a.responses;
    return a.name.localeCompare(b.name);
  });
  return items;
}
