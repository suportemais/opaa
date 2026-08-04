import { NpsClass } from '@prisma/client';
import { calculateNps, classifyNps } from './nps';

describe('nps', () => {
  it('classifies detractor/passive/promoter', () => {
    expect(classifyNps(0)).toBe(NpsClass.detractor);
    expect(classifyNps(6)).toBe(NpsClass.detractor);
    expect(classifyNps(7)).toBe(NpsClass.passive);
    expect(classifyNps(8)).toBe(NpsClass.passive);
    expect(classifyNps(9)).toBe(NpsClass.promoter);
    expect(classifyNps(10)).toBe(NpsClass.promoter);
  });

  it('calculates NPS percentage', () => {
    const result = calculateNps([10, 9, 8, 7, 6, 0]);
    expect(result.total).toBe(6);
    expect(result.promoters).toBe(2);
    expect(result.detractors).toBe(2);
    expect(result.passives).toBe(2);
    expect(result.nps).toBe(0);
  });

  it('ignores invalid values', () => {
    const result = calculateNps([10, 11, -1, NaN]);
    expect(result.total).toBe(1);
    expect(result.nps).toBe(100);
  });
});

