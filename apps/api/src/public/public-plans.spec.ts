import { COMMERCIAL_PLANS, listPublicPlans, type CommercialPlan } from './public-plans';

describe('listPublicPlans', () => {
  it('returns only ACTIVE + isPublic plans, ordered', () => {
    const plans = listPublicPlans();
    expect(plans.map((p) => p.slug)).toEqual(['start', 'pro', 'redes']);
    expect(plans.every((p) => !('status' in p) && !('isPublic' in p))).toBe(true);
  });

  it('hides inactive or private plans', () => {
    const catalog: CommercialPlan[] = [
      { ...COMMERCIAL_PLANS[0]!, status: 'INACTIVE', isPublic: true },
      { ...COMMERCIAL_PLANS[1]!, status: 'ACTIVE', isPublic: false },
      { ...COMMERCIAL_PLANS[2]!, status: 'ACTIVE', isPublic: true, sortOrder: 9 },
    ];
    expect(listPublicPlans(catalog).map((p) => p.slug)).toEqual(['redes']);
  });

  it('returns empty when nothing is public', () => {
    const catalog = COMMERCIAL_PLANS.map((p) => ({ ...p, isPublic: false }));
    expect(listPublicPlans(catalog)).toEqual([]);
  });

  it('keeps locked commercial prices and badges', () => {
    const bySlug = Object.fromEntries(listPublicPlans().map((p) => [p.slug, p]));
    expect(bySlug.start?.priceCents).toBe(14700);
    expect(bySlug.pro?.priceCents).toBe(29700);
    expect(bySlug.redes?.priceCents).toBe(69700);
    expect(bySlug.start?.badge).toBe('Ideal para começar');
    expect(bySlug.pro?.badge).toBe('Mais popular');
    expect(bySlug.redes?.badge).toBe('Para redes e franquias');
    expect(bySlug.pro?.ctaLabel).toBe('Assinar');
    expect(bySlug.start?.trialDays).toBe(14);
    expect(bySlug.start?.summary).toBe('NPS e ocorrências para a sua unidade.');
    expect(bySlug.pro?.summary).toBe('NPS, dashboard e Kanban para a sua unidade.');
    expect(bySlug.redes?.summary).toBe('NPS e atendimento em todas as suas unidades.');
    expect(bySlug.start?.features).toEqual(['Pesquisa NPS', 'Ocorrências', '1 unidade']);
  });
});
