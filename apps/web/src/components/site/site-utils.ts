import type { CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { FALLBACK_PUBLIC_PLANS, type PublicPlan } from '../../lib/public-plans';

/** Utilitários do visual do site (LP, login, onboarding). Componentes em SiteBits.tsx. */

export const LOGO_SRC = '/site/icons/logo-opiina-256.png';

/** Atraso de entrada das animações (`--d` no CSS). */
export function atraso(segundos: number): CSSProperties {
  return { '--d': `${segundos}s` } as CSSProperties;
}

/** Planos públicos (editáveis no admin). Se a API falhar, usa o catálogo de reserva. */
export function usePublicPlans() {
  const query = useQuery({
    queryKey: ['publicPlans'],
    queryFn: () => apiFetch<PublicPlan[]>('/public/plans'),
  });
  const plans = query.isError ? FALLBACK_PUBLIC_PLANS : (query.data ?? null);
  return { plans, isLoading: query.isLoading };
}

export function planoEmDestaque(plan: PublicPlan) {
  return plan.featured ?? plan.slug === 'pro';
}
