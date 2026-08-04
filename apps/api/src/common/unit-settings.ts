export function googleBusinessUrlFromSettings(settings: unknown): string | null {
  const raw = (settings as any)?.googleBusinessUrl;
  const v = typeof raw === 'string' ? raw.trim() : '';
  return v ? v : null;
}

export function withGoogleBusinessUrl(settings: unknown, value: unknown) {
  const base = settings && typeof settings === 'object' ? ({ ...(settings as any) } as any) : {};
  const v = typeof value === 'string' ? value.trim() : '';
  if (!v) {
    delete base.googleBusinessUrl;
    return base;
  }
  return { ...base, googleBusinessUrl: v };
}

