import type { SentimentLabel } from './classify';

export type SentimentRow = {
  sentiment: SentimentLabel | string | null;
  sentimentTheme: string | null;
};

export type ThemeBreakdown = {
  theme: string;
  total: number;
  elogio: number;
  reclamacao: number;
  neutro: number;
};

export type SentimentAggregate = {
  responses: number;
  classified: number;
  unclassified: number;
  counts: { elogio: number; reclamacao: number; neutro: number };
  percents: { elogio: number; reclamacao: number; neutro: number };
  byTheme: ThemeBreakdown[];
};

function percent(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function isLabel(value: string | null): value is SentimentLabel {
  return value === 'elogio' || value === 'reclamacao' || value === 'neutro';
}

export function aggregateSentiment(rows: SentimentRow[]): SentimentAggregate {
  const counts = { elogio: 0, reclamacao: 0, neutro: 0 };
  const themeMap = new Map<string, ThemeBreakdown>();

  for (const row of rows) {
    if (!isLabel(row.sentiment)) continue;
    counts[row.sentiment] += 1;

    const theme = (row.sentimentTheme ?? '').trim() || 'outro';
    const bucket = themeMap.get(theme) ?? {
      theme,
      total: 0,
      elogio: 0,
      reclamacao: 0,
      neutro: 0,
    };
    bucket.total += 1;
    bucket[row.sentiment] += 1;
    themeMap.set(theme, bucket);
  }

  const classified = counts.elogio + counts.reclamacao + counts.neutro;
  const byTheme = Array.from(themeMap.values()).sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return a.theme.localeCompare(b.theme, 'pt-BR');
  });

  return {
    responses: rows.length,
    classified,
    unclassified: Math.max(0, rows.length - classified),
    counts,
    percents: {
      elogio: percent(counts.elogio, classified),
      reclamacao: percent(counts.reclamacao, classified),
      neutro: percent(counts.neutro, classified),
    },
    byTheme,
  };
}
