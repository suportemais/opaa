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

/**
 * Catálogo comercial travado (op-20260903-02).
 * summary/features ficam como [COPY] até o texto aprovado ser colado nestes campos.
 */
export const COMMERCIAL_PLANS: CommercialPlan[] = [
  {
    slug: 'start',
    name: 'Start',
    badge: 'Ideal para começar',
    summary: '[COPY]',
    priceCents: 14700,
    currency: 'BRL',
    features: ['[COPY]', '[COPY]', '[COPY]'],
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
    summary: '[COPY]',
    priceCents: 29700,
    currency: 'BRL',
    features: ['[COPY]', '[COPY]', '[COPY]', '[COPY]'],
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
    summary: '[COPY]',
    priceCents: 69700,
    currency: 'BRL',
    features: ['[COPY]', '[COPY]', '[COPY]', '[COPY]'],
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
