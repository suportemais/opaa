export type PlanStatus = 'ACTIVE' | 'INACTIVE';

export type CommercialPlan = {
  slug: 'start' | 'pro' | 'redes';
  name: string;
  badge: string;
  summary: string;
  priceCents: number;
  currency: 'BRL';
  features: string[];
  ctaLabel: 'Assinar';
  trialDays: number;
  status: PlanStatus;
  isPublic: boolean;
  sortOrder: number;
};

export type PublicPlan = Omit<CommercialPlan, 'status' | 'isPublic'>;

/** Catálogo comercial travado (op-20260903-02 / LANDING_COPY). */
export const COMMERCIAL_PLANS: CommercialPlan[] = [
  {
    slug: 'start',
    name: 'Start',
    badge: 'Ideal para começar',
    summary: 'NPS e ocorrências para a sua unidade.',
    priceCents: 14700,
    currency: 'BRL',
    features: ['Pesquisa NPS', 'Ocorrências', '1 unidade'],
    ctaLabel: 'Assinar',
    trialDays: 14,
    status: 'ACTIVE',
    isPublic: true,
    sortOrder: 1,
  },
  {
    slug: 'pro',
    name: 'Pro',
    badge: 'Mais popular',
    summary: 'NPS, dashboard e Kanban para a sua unidade.',
    priceCents: 29700,
    currency: 'BRL',
    features: ['Pesquisa NPS', 'Ocorrências', 'Dashboard', 'Kanban de atendimento', '5 usuários', '1 unidade'],
    ctaLabel: 'Assinar',
    trialDays: 14,
    status: 'ACTIVE',
    isPublic: true,
    sortOrder: 2,
  },
  {
    slug: 'redes',
    name: 'Redes',
    badge: 'Para redes e franquias',
    summary: 'NPS e atendimento em todas as suas unidades.',
    priceCents: 69700,
    currency: 'BRL',
    features: [
      'Pesquisa NPS',
      'Ocorrências',
      'Dashboard',
      'Kanban de atendimento',
      'Métricas por unidade',
      'Unidades ilimitadas',
      '20 usuários',
    ],
    ctaLabel: 'Assinar',
    trialDays: 14,
    status: 'ACTIVE',
    isPublic: true,
    sortOrder: 3,
  },
];

export function listPublicPlans(plans: CommercialPlan[] = COMMERCIAL_PLANS): PublicPlan[] {
  return plans
    .filter((plan) => plan.status === 'ACTIVE' && plan.isPublic)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((plan) => ({
      slug: plan.slug,
      name: plan.name,
      badge: plan.badge,
      summary: plan.summary,
      priceCents: plan.priceCents,
      currency: plan.currency,
      features: plan.features,
      ctaLabel: plan.ctaLabel,
      trialDays: plan.trialDays,
      sortOrder: plan.sortOrder,
    }));
}
