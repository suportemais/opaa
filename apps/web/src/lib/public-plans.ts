export type PublicPlan = {
  slug: string;
  name: string;
  badge: string;
  summary: string;
  priceCents: number;
  currency: string;
  features: string[];
  ctaLabel: string;
  trialDays: number;
  sortOrder: number;
};

/** Catálogo comercial travado (op-20260903-02). Usado se GET /public/plans falhar. */
export const FALLBACK_PUBLIC_PLANS: PublicPlan[] = [
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
    sortOrder: 3,
  },
];

export const PLAN_SUBSCRIBE_PATH = '/onboarding';

export function subscribeHref(planSlug?: string) {
  if (!planSlug) return PLAN_SUBSCRIBE_PATH;
  const params = new URLSearchParams({ plan: planSlug });
  return `${PLAN_SUBSCRIBE_PATH}?${params.toString()}`;
}

export function formatPlanPrice(priceCents: number, currency = 'BRL') {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(priceCents / 100);
}
