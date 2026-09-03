export type PlanFeature = {
  key: string;
  label: string;
  included: boolean;
};

function slugifyFeature(value: string) {
  const ascii = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return ascii
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeFeatures(raw: unknown): PlanFeature[] {
  if (!Array.isArray(raw)) return [];
  const features: PlanFeature[] = [];
  for (const [index, item] of raw.entries()) {
    if (typeof item === 'string') {
      const label = item.trim();
      if (!label) continue;
      features.push({ key: slugifyFeature(label) || `feature-${index}`, label, included: true });
      continue;
    }
    if (!item || typeof item !== 'object') continue;
    const record = item as { key?: unknown; label?: unknown; included?: unknown };
    const label = typeof record.label === 'string' ? record.label.trim() : '';
    if (!label) continue;
    const key =
      typeof record.key === 'string' && record.key.trim()
        ? record.key.trim()
        : slugifyFeature(label) || `feature-${index}`;
    features.push({ key, label, included: record.included !== false });
  }
  return features;
}

export function formatPriceLabel(amountCents: number, currency = 'BRL'): string {
  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amountCents / 100);
  return `${formatted}/mês`;
}

export type PublicPlan = {
  slug: string;
  name: string;
  badge: string;
  summary: string;
  shortDescription?: string | null;
  priceCents: number;
  amountCents?: number;
  currency: string;
  features: string[];
  ctaLabel: string;
  trialDays: number;
  sortOrder: number;
  displayOrder?: number;
  featured?: boolean;
  maxUnits?: number | null;
  maxUsers?: number | null;
  annualAmountCents?: number | null;
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

/** Começar / trial: /onboarding. Assinar: /onboarding?plan=slug. */
export const START_HREF = '/onboarding';
export const PLAN_SUBSCRIBE_PATH = '/onboarding';

export function subscribeHref(planSlug?: string) {
  if (!planSlug) return START_HREF;
  const params = new URLSearchParams({ plan: planSlug });
  return `${PLAN_SUBSCRIBE_PATH}?${params.toString()}`;
}

export function formatPlanPrice(priceCents: number, currency = 'BRL') {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(priceCents / 100);
}
