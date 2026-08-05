import type { Request } from 'express';

function normalizeHost(value: string) {
  const first = value.split(',')[0]?.trim() ?? '';
  return first.toLowerCase().replace(/:\d+$/, '');
}

export function requestHost(req?: Request) {
  const forwarded = req?.headers['x-forwarded-host'];
  if (typeof forwarded === 'string' && forwarded.trim()) return normalizeHost(forwarded);
  const host = req?.headers?.host;
  if (typeof host === 'string' && host.trim()) return normalizeHost(host);
  return null;
}

export function baseDomain() {
  const base = (process.env.APP_BASE_DOMAIN ?? '').trim().toLowerCase();
  if (base) return base;
  const baseUrl = (process.env.APP_BASE_URL ?? '').trim();
  if (!baseUrl) return null;
  try {
    return new URL(baseUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function tenantSlugFromHost(host: string, base: string) {
  const normalizedHost = normalizeHost(host);
  const normalizedBase = normalizeHost(base);

  if (normalizedHost === normalizedBase) return null;
  const suffix = `.${normalizedBase}`;
  if (!normalizedHost.endsWith(suffix)) return null;

  const prefix = normalizedHost.slice(0, -suffix.length);
  if (!prefix) return null;
  if (prefix.includes('.')) return null;
  if (prefix === 'www') return null;
  return prefix;
}

