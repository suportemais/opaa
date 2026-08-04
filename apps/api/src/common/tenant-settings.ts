export function badScoreThresholdFromSettings(settings: unknown): number {
  const raw = (settings as any)?.badScoreThreshold;
  const n = typeof raw === 'number' && Number.isFinite(raw) ? raw : 6;
  const v = Math.round(n);
  if (v < 1) return 1;
  if (v > 10) return 10;
  return v;
}

export function withBadScoreThreshold(settings: unknown, value: number) {
  const v = Math.round(value);
  const normalized = v < 1 ? 1 : v > 10 ? 10 : v;
  const base = settings && typeof settings === 'object' ? settings : {};
  return { ...(base as any), badScoreThreshold: normalized };
}
