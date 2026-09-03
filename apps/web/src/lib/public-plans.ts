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

/** Catálogo comercial travado (op-20260903-02 / LANDING_COPY). Usado se GET /public/plans falhar. */
export const FALLBACK_PUBLIC_PLANS: PublicPlan[] = [
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
    sortOrder: 3,
  },
];

/** Começar / trial: /register → onboarding. Assinar: /register?plan=slug (Stripe depois). */
export const START_HREF = '/register';
export const PLAN_SUBSCRIBE_PATH = '/register';

export function subscribeHref(planSlug?: string) {
  if (!planSlug) return START_HREF;
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
