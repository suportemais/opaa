export const PLAN_SECTION_TITLE = 'Planos pra sua operação';
export const PLAN_SECTION_SUBTITLE =
  'Preços claros pra rede e restaurante. Sem surpresa na fatura.';
export const PLAN_TRIAL_LABEL = 'Teste grátis por 14 dias';
export const PLAN_CTA_LABEL = 'Assinar';

export type PlanFeature = {
  key: string;
  label: string;
  included: boolean;
};

export type PlanCatalogItem = {
  name: string;
  slug: string;
  shortDescription: string;
  badge: string;
  ctaLabel: string;
  amountCents: number;
  currency: string;
  billingInterval: string;
  trialDays: number;
  features: PlanFeature[];
  maxUnits: number | null;
  maxUsers: number | null;
  featured: boolean;
  isPublic: boolean;
  isActive: boolean;
  displayOrder: number;
  annualAmountCents: number;
};

export type PublicPlan = {
  name: string;
  slug: string;
  amountCents: number;
  currency: string;
  billingInterval: string;
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

export const OPIINA_PLANS: PlanCatalogItem[] = [
  {
    name: 'Start',
    slug: 'start',
    shortDescription: 'NPS e ocorrências para a sua unidade.',
    badge: 'Ideal para começar',
    ctaLabel: PLAN_CTA_LABEL,
    amountCents: 14700,
    currency: 'BRL',
    billingInterval: 'MONTH',
    trialDays: 14,
    features: [
      { key: 'nps', label: 'Pesquisa NPS', included: true },
      { key: 'occurrences', label: 'Ocorrências', included: true },
      { key: 'units', label: '1 unidade', included: true },
    ],
    maxUnits: 1,
    maxUsers: null,
    featured: false,
    isPublic: true,
    isActive: true,
    displayOrder: 1,
    annualAmountCents: 147000,
  },
  {
    name: 'Pro',
    slug: 'pro',
    shortDescription: 'NPS, dashboard e Kanban para a sua unidade.',
    badge: 'Mais popular',
    ctaLabel: PLAN_CTA_LABEL,
    amountCents: 29700,
    currency: 'BRL',
    billingInterval: 'MONTH',
    trialDays: 14,
    features: [
      { key: 'nps', label: 'Pesquisa NPS', included: true },
      { key: 'occurrences', label: 'Ocorrências', included: true },
      { key: 'dashboard', label: 'Dashboard', included: true },
      { key: 'kanban', label: 'Kanban de atendimento', included: true },
      { key: 'users', label: '5 usuários', included: true },
      { key: 'units', label: '1 unidade', included: true },
    ],
    maxUnits: 1,
    maxUsers: 5,
    featured: true,
    isPublic: true,
    isActive: true,
    displayOrder: 2,
    annualAmountCents: 297000,
  },
  {
    name: 'Redes',
    slug: 'redes',
    shortDescription: 'NPS e atendimento em todas as suas unidades.',
    badge: 'Para redes e franquias',
    ctaLabel: PLAN_CTA_LABEL,
    amountCents: 69700,
    currency: 'BRL',
    billingInterval: 'MONTH',
    trialDays: 14,
    features: [
      { key: 'nps', label: 'Pesquisa NPS', included: true },
      { key: 'occurrences', label: 'Ocorrências', included: true },
      { key: 'dashboard', label: 'Dashboard', included: true },
      { key: 'kanban', label: 'Kanban de atendimento', included: true },
      { key: 'unit_metrics', label: 'Métricas por unidade', included: true },
      { key: 'units', label: 'Unidades ilimitadas', included: true },
      { key: 'users', label: '20 usuários', included: true },
    ],
    maxUnits: null,
    maxUsers: 20,
    featured: false,
    isPublic: true,
    isActive: true,
    displayOrder: 3,
    annualAmountCents: 697000,
  },
];

function slugifyFeature(value: string) {
  const ascii = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const normalized = ascii
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized;
}

export function normalizeFeatures(raw: unknown): PlanFeature[] {
  if (!Array.isArray(raw)) return [];

  const features: PlanFeature[] = [];
  for (const [index, item] of raw.entries()) {
    if (typeof item === 'string') {
      const label = item.trim();
      if (!label) continue;
      features.push({
        key: slugifyFeature(label) || `feature-${index}`,
        label,
        included: true,
      });
      continue;
    }

    if (!item || typeof item !== 'object') continue;
    const record = item as {
      key?: unknown;
      label?: unknown;
      included?: unknown;
    };
    const label = typeof record.label === 'string' ? record.label.trim() : '';
    if (!label) continue;
    const key =
      typeof record.key === 'string' && record.key.trim()
        ? record.key.trim()
        : slugifyFeature(label) || `feature-${index}`;
    features.push({
      key,
      label,
      included: record.included !== false,
    });
  }
  return features;
}

function asNullableInt(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function asInt(value: unknown, fallback: number): number {
  const n = asNullableInt(value);
  return n === null ? fallback : n;
}

export function formatPriceLabel(
  amountCents: number,
  currency = 'BRL',
): string {
  const value = amountCents / 100;
  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
  return `${formatted}/mês`;
}

export function formatAnnualPriceLabel(
  amountCents: number,
  currency = 'BRL',
): string {
  const value = amountCents / 100;
  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
  return `${formatted}/ano (2 meses grátis)`;
}

export function trialLabel(trialDays: number): string {
  return `Teste grátis por ${trialDays} dias`;
}

export function toPublicPlan(row: {
  name?: unknown;
  slug?: unknown;
  amountCents?: unknown;
  currency?: unknown;
  billingInterval?: unknown;
  badge?: unknown;
  shortDescription?: unknown;
  features?: unknown;
  trialDays?: unknown;
  ctaLabel?: unknown;
  featured?: unknown;
  maxUnits?: unknown;
  maxUsers?: unknown;
  annualAmountCents?: unknown;
  displayOrder?: unknown;
  isPublic?: unknown;
  isActive?: unknown;
}): PublicPlan | null {
  const slug = typeof row.slug === 'string' ? row.slug.trim() : '';
  const name = typeof row.name === 'string' ? row.name.trim() : '';
  const amountCents = asNullableInt(row.amountCents);
  if (!slug || !name || amountCents === null || amountCents < 0) return null;

  return {
    name,
    slug,
    amountCents,
    currency:
      typeof row.currency === 'string' && row.currency.trim()
        ? row.currency.trim()
        : 'BRL',
    billingInterval:
      typeof row.billingInterval === 'string' && row.billingInterval.trim()
        ? row.billingInterval.trim()
        : 'MONTH',
    badge:
      typeof row.badge === 'string' && row.badge.trim()
        ? row.badge.trim()
        : null,
    shortDescription:
      typeof row.shortDescription === 'string' && row.shortDescription.trim()
        ? row.shortDescription.trim()
        : null,
    features: normalizeFeatures(row.features),
    trialDays: asInt(row.trialDays, 14),
    ctaLabel:
      typeof row.ctaLabel === 'string' && row.ctaLabel.trim()
        ? row.ctaLabel.trim()
        : PLAN_CTA_LABEL,
    featured: row.featured === true,
    maxUnits: asNullableInt(row.maxUnits),
    maxUsers: asNullableInt(row.maxUsers),
    annualAmountCents: asNullableInt(row.annualAmountCents),
    displayOrder: asInt(row.displayOrder, 0),
  };
}

export function normalizePublicPlans(rows: unknown[]): PublicPlan[] {
  if (!Array.isArray(rows)) return [];

  const plans: PublicPlan[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const record = row as {
      isPublic?: unknown;
      isActive?: unknown;
    };
    if (record.isPublic === false || record.isActive === false) continue;
    const plan = toPublicPlan(record);
    if (plan) plans.push(plan);
  }

  return plans.sort(
    (a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name),
  );
}

export function fallbackPublicPlans(): PublicPlan[] {
  return normalizePublicPlans(OPIINA_PLANS);
}
