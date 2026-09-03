export const PLAN_SECTION_TITLE = 'Planos pra sua operação';
export const PLAN_SECTION_SUBTITLE = 'Preços claros pra rede e restaurante. Sem surpresa na fatura.';

export type PlanFeature = {
  key: string;
  label: string;
  included: boolean;
};

export type PublicPlan = {
  name: string;
  slug: string;
  amountCents: number;
  currency: string;
  badge: string | null;
  shortDescription: string | null;
  features: PlanFeature[];
  trialDays: number;
  ctaLabel: string;
  featured: boolean;
  maxUnits: number | null;
  maxUsers: number | null;
  annualAmountCents: number | null;
  displayOrder: number;
};

export const FALLBACK_PUBLIC_PLANS: PublicPlan[] = [
  {
    name: 'Start',
    slug: 'start',
    amountCents: 14700,
    currency: 'BRL',
    badge: 'Ideal para começar',
    shortDescription: 'NPS e ocorrências para a sua unidade.',
    features: [
      { key: 'nps', label: 'Pesquisa NPS', included: true },
      { key: 'occurrences', label: 'Ocorrências', included: true },
      { key: 'units', label: '1 unidade', included: true },
    ],
    trialDays: 14,
    ctaLabel: 'Assinar',
    featured: false,
    maxUnits: 1,
    maxUsers: null,
    annualAmountCents: 147000,
    displayOrder: 1,
  },
  {
    name: 'Pro',
    slug: 'pro',
    amountCents: 29700,
    currency: 'BRL',
    badge: 'Mais popular',
    shortDescription: 'NPS, dashboard e Kanban para a sua unidade.',
    features: [
      { key: 'nps', label: 'Pesquisa NPS', included: true },
      { key: 'occurrences', label: 'Ocorrências', included: true },
      { key: 'dashboard', label: 'Dashboard', included: true },
      { key: 'kanban', label: 'Kanban de atendimento', included: true },
      { key: 'users', label: '5 usuários', included: true },
      { key: 'units', label: '1 unidade', included: true },
    ],
    trialDays: 14,
    ctaLabel: 'Assinar',
    featured: true,
    maxUnits: 1,
    maxUsers: 5,
    annualAmountCents: 297000,
    displayOrder: 2,
  },
  {
    name: 'Redes',
    slug: 'redes',
    amountCents: 69700,
    currency: 'BRL',
    badge: 'Para redes e franquias',
    shortDescription: 'NPS e atendimento em todas as suas unidades.',
    features: [
      { key: 'nps', label: 'Pesquisa NPS', included: true },
      { key: 'occurrences', label: 'Ocorrências', included: true },
      { key: 'dashboard', label: 'Dashboard', included: true },
      { key: 'kanban', label: 'Kanban de atendimento', included: true },
      { key: 'unit_metrics', label: 'Métricas por unidade', included: true },
      { key: 'units', label: 'Unidades ilimitadas', included: true },
      { key: 'users', label: '20 usuários', included: true },
    ],
    trialDays: 14,
    ctaLabel: 'Assinar',
    featured: false,
    maxUnits: null,
    maxUsers: 20,
    annualAmountCents: 697000,
    displayOrder: 3,
  },
];

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

function asNullableInt(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
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

export function formatAnnualPriceLabel(amountCents: number, currency = 'BRL'): string {
  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amountCents / 100);
  return `${formatted}/ano (2 meses grátis)`;
}

export function trialLabel(trialDays: number): string {
  return `Teste grátis por ${trialDays} dias`;
}

export function normalizePublicPlans(rows: unknown[]): PublicPlan[] {
  if (!Array.isArray(rows)) return [];
  const plans: PublicPlan[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const record = row as Record<string, unknown>;
    if (record.isPublic === false || record.isActive === false) continue;
    const slug = typeof record.slug === 'string' ? record.slug.trim() : '';
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    const amountCents = asNullableInt(record.amountCents);
    if (!slug || !name || amountCents === null || amountCents < 0) continue;
    plans.push({
      name,
      slug,
      amountCents,
      currency: typeof record.currency === 'string' && record.currency.trim() ? record.currency.trim() : 'BRL',
      badge: typeof record.badge === 'string' && record.badge.trim() ? record.badge.trim() : null,
      shortDescription:
        typeof record.shortDescription === 'string' && record.shortDescription.trim()
          ? record.shortDescription.trim()
          : null,
      features: normalizeFeatures(record.features),
      trialDays: asNullableInt(record.trialDays) ?? 14,
      ctaLabel: typeof record.ctaLabel === 'string' && record.ctaLabel.trim() ? record.ctaLabel.trim() : 'Assinar',
      featured: record.featured === true,
      maxUnits: asNullableInt(record.maxUnits),
      maxUsers: asNullableInt(record.maxUsers),
      annualAmountCents: asNullableInt(record.annualAmountCents),
      displayOrder: asNullableInt(record.displayOrder) ?? 0,
    });
  }
  return plans.sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
}

export function resolvePublicPlans(rows: unknown[] | null | undefined): PublicPlan[] {
  const normalized = normalizePublicPlans(rows ?? []);
  return normalized.length > 0 ? normalized : FALLBACK_PUBLIC_PLANS;
}

export function findFallbackPlan(slug: string | null | undefined): PublicPlan | undefined {
  if (!slug) return undefined;
  return FALLBACK_PUBLIC_PLANS.find((plan) => plan.slug === slug);
}
