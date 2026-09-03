import {
  OPIINA_PLANS,
  fallbackPublicPlans,
  formatAnnualPriceLabel,
  formatPriceLabel,
  normalizeFeatures,
  normalizePublicPlans,
  trialLabel,
} from './plan-catalog';

describe('plan-catalog', () => {
  it('defines the three OPIINA public plans with literal copy and prices', () => {
    expect(OPIINA_PLANS.map((p) => p.slug)).toEqual(['start', 'pro', 'redes']);

    const start = OPIINA_PLANS[0];
    expect(start.name).toBe('Start');
    expect(start.amountCents).toBe(14700);
    expect(start.annualAmountCents).toBe(147000);
    expect(start.badge).toBe('Ideal para começar');
    expect(start.shortDescription).toBe(
      'NPS e ocorrências para a sua unidade.',
    );
    expect(start.features.map((f) => f.label)).toEqual([
      'Pesquisa NPS',
      'Ocorrências',
      '1 unidade',
    ]);
    expect(start.maxUnits).toBe(1);
    expect(start.maxUsers).toBeNull();
    expect(start.featured).toBe(false);
    expect(start.ctaLabel).toBe('Assinar');
    expect(start.displayOrder).toBe(1);

    const pro = OPIINA_PLANS[1];
    expect(pro.amountCents).toBe(29700);
    expect(pro.badge).toBe('Mais popular');
    expect(pro.shortDescription).toBe(
      'NPS, dashboard e Kanban para a sua unidade.',
    );
    expect(pro.features.map((f) => f.label)).toEqual([
      'Pesquisa NPS',
      'Ocorrências',
      'Dashboard',
      'Kanban de atendimento',
      '5 usuários',
      '1 unidade',
    ]);
    expect(pro.maxUnits).toBe(1);
    expect(pro.maxUsers).toBe(5);
    expect(pro.featured).toBe(true);

    const redes = OPIINA_PLANS[2];
    expect(redes.amountCents).toBe(69700);
    expect(redes.badge).toBe('Para redes e franquias');
    expect(redes.shortDescription).toBe(
      'NPS e atendimento em todas as suas unidades.',
    );
    expect(redes.features.map((f) => f.label)).toEqual([
      'Pesquisa NPS',
      'Ocorrências',
      'Dashboard',
      'Kanban de atendimento',
      'Métricas por unidade',
      'Unidades ilimitadas',
      '20 usuários',
    ]);
    expect(redes.maxUnits).toBeNull();
    expect(redes.maxUsers).toBe(20);
    expect(redes.featured).toBe(false);
  });

  it('formats monthly and annual price labels in pt-BR', () => {
    const compact = (value: string) => value.replace(/\s/g, ' ');
    expect(compact(formatPriceLabel(14700))).toBe('R$ 147/mês');
    expect(compact(formatPriceLabel(29700))).toBe('R$ 297/mês');
    expect(compact(formatPriceLabel(69700))).toBe('R$ 697/mês');
    expect(compact(formatAnnualPriceLabel(147000))).toBe(
      'R$ 1.470/ano (2 meses grátis)',
    );
  });

  it('builds the trial line from trialDays', () => {
    expect(trialLabel(14)).toBe('Teste grátis por 14 dias');
  });

  it('normalizes string and object features', () => {
    expect(
      normalizeFeatures([
        'Pesquisa NPS',
        { key: 'kanban', label: 'Kanban de atendimento' },
      ]),
    ).toEqual([
      { key: 'pesquisa-nps', label: 'Pesquisa NPS', included: true },
      { key: 'kanban', label: 'Kanban de atendimento', included: true },
    ]);
  });

  it('keeps only public/active plans and sorts by displayOrder', () => {
    const plans = normalizePublicPlans([
      {
        name: 'Redes',
        slug: 'redes',
        amountCents: 69700,
        displayOrder: 3,
        isPublic: true,
        features: ['Pesquisa NPS'],
      },
      {
        name: 'Hidden',
        slug: 'hidden',
        amountCents: 100,
        displayOrder: 0,
        isPublic: false,
        features: [],
      },
      {
        name: 'Start',
        slug: 'start',
        amountCents: 14700,
        displayOrder: 1,
        isActive: true,
        features: [{ label: 'Ocorrências' }],
      },
    ]);

    expect(plans.map((p) => p.slug)).toEqual(['start', 'redes']);
    expect(plans[0].features[0].label).toBe('Ocorrências');
  });

  it('falls back to the literal catalog', () => {
    expect(fallbackPublicPlans()).toHaveLength(3);
    expect(fallbackPublicPlans().map((p) => p.slug)).toEqual([
      'start',
      'pro',
      'redes',
    ]);
  });
});
