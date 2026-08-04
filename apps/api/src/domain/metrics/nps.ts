import { NpsClass } from '@prisma/client';

export function classifyNps(score: number): NpsClass {
  if (score <= 6) return NpsClass.detractor;
  if (score <= 8) return NpsClass.passive;
  return NpsClass.promoter;
}

export function calculateNps(scores: number[]) {
  const valid = scores.filter((s) => Number.isFinite(s) && s >= 0 && s <= 10);
  const total = valid.length;
  if (total === 0) {
    return { total: 0, promoters: 0, passives: 0, detractors: 0, nps: null as number | null };
  }

  const promoters = valid.filter((s) => s >= 9).length;
  const detractors = valid.filter((s) => s <= 6).length;
  const passives = total - promoters - detractors;
  const nps = Math.round(((promoters - detractors) / total) * 100);

  return { total, promoters, passives, detractors, nps };
}

