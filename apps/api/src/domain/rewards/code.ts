import { randomBytes } from 'crypto';

export function generateRewardCode(prefix?: string | null): string {
  const normalized = (prefix ?? 'MM').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6);
  const head = normalized || 'MM';
  const body = randomBytes(5).toString('hex').toUpperCase().slice(0, 8);
  return `${head}${body}`;
}

export function buildRewardDeepLink(params: { appBaseUrl?: string | null; code: string }): string {
  const path = `/app?voucher=${encodeURIComponent(params.code)}`;
  const base = (params.appBaseUrl ?? '').trim().replace(/\/+$/, '');
  return base ? `${base}${path}` : path;
}

export function formatRewardAmountBrl(amountCents: number): string {
  const safe = Number.isFinite(amountCents) ? Math.max(0, Math.round(amountCents)) : 0;
  const formatted = (safe / 100).toFixed(2).replace('.', ',');
  return `R$ ${formatted}`;
}
