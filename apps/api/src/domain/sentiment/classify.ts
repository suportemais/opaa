import { NpsClass } from '@prisma/client';

export const SENTIMENT_LABELS = ['elogio', 'reclamacao', 'neutro'] as const;
export type SentimentLabel = (typeof SENTIMENT_LABELS)[number];

export const SENTIMENT_SOURCES = ['groq', 'score', 'skipped'] as const;
export type SentimentSource = (typeof SENTIMENT_SOURCES)[number];

export const CANONICAL_THEMES = [
  'atendimento',
  'espera',
  'comida',
  'preco',
  'limpeza',
  'qualidade',
  'ambiente',
  'entrega',
  'produto',
  'outro',
] as const;
export type CanonicalTheme = (typeof CANONICAL_THEMES)[number];

export const THEME_ALIASES: Record<string, CanonicalTheme> = {
  atendimento: 'atendimento',
  staff: 'atendimento',
  funcionario: 'atendimento',
  funcionarioa: 'atendimento',
  garcom: 'atendimento',
  espera: 'espera',
  tempo: 'espera',
  fila: 'espera',
  demora: 'espera',
  comida: 'comida',
  cardapio: 'comida',
  sabor: 'comida',
  refeicao: 'comida',
  preco: 'preco',
  valor: 'preco',
  custo: 'preco',
  limpeza: 'limpeza',
  higiene: 'limpeza',
  qualidade: 'qualidade',
  ambiente: 'ambiente',
  clima: 'ambiente',
  entrega: 'entrega',
  delivery: 'entrega',
  produto: 'produto',
  outro: 'outro',
  geral: 'outro',
};

export type ClassificationResult = {
  label: SentimentLabel;
  theme: CanonicalTheme | null;
  summary: string;
  source: SentimentSource;
};

const MIN_COMMENT_LENGTH = 2;
const MAX_COMMENT_LENGTH = 4000;
const MAX_SUMMARY_LENGTH = 160;

function stripDiacritics(value: string) {
  return value.normalize('NFD').replace(/\p{M}/gu, '');
}

function asText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  return '';
}

function normalizeKey(value: unknown): string {
  return stripDiacritics(asText(value))
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function hasUsableComment(text: string | null | undefined): boolean {
  return typeof text === 'string' && text.trim().length >= MIN_COMMENT_LENGTH;
}

export function collectCommentText(params: {
  mainComment?: string | null;
  answers?: Array<{ value: unknown }>;
}): string {
  const parts: string[] = [];
  const push = (raw: string) => {
    const t = raw.trim();
    if (t.length < MIN_COMMENT_LENGTH) return;
    if (parts.includes(t)) return;
    parts.push(t);
  };

  if (typeof params.mainComment === 'string') push(params.mainComment);
  for (const answer of params.answers ?? []) {
    if (typeof answer.value === 'string') push(answer.value);
  }

  return parts.join('\n').slice(0, MAX_COMMENT_LENGTH);
}

export function mapSentimentLabel(input: unknown): SentimentLabel {
  const key = normalizeKey(input).replace(/\s+/g, '');
  if (
    [
      'elogio',
      'elogios',
      'praise',
      'positive',
      'positivo',
      'promoter',
      'promotor',
      'compliment',
    ].includes(key)
  ) {
    return 'elogio';
  }
  if (
    [
      'reclamacao',
      'reclamacoes',
      'complaint',
      'complaints',
      'negative',
      'negativo',
      'detractor',
      'detrator',
      'critica',
    ].includes(key)
  ) {
    return 'reclamacao';
  }
  return 'neutro';
}

export function normalizeTheme(input: unknown): CanonicalTheme {
  const key = normalizeKey(input).replace(/\s+/g, '');
  if (!key) return 'outro';
  if ((CANONICAL_THEMES as readonly string[]).includes(key))
    return key as CanonicalTheme;
  if (THEME_ALIASES[key]) return THEME_ALIASES[key];
  for (const theme of CANONICAL_THEMES) {
    if (key.includes(theme) || theme.includes(key)) return theme;
  }
  return 'outro';
}

export function clampSummary(input: unknown): string {
  const text = asText(input).replace(/\s+/g, ' ').trim();
  if (!text) return 'Sem resumo.';
  return text.length > MAX_SUMMARY_LENGTH
    ? `${text.slice(0, MAX_SUMMARY_LENGTH - 1).trimEnd()}…`
    : text;
}

export function classifyFromScore(
  npsClass: NpsClass | null | undefined,
): ClassificationResult | null {
  if (npsClass === NpsClass.promoter) {
    return {
      label: 'elogio',
      theme: null,
      summary: 'Classificado pelo NPS (promotor), sem comentário.',
      source: 'score',
    };
  }
  if (npsClass === NpsClass.detractor) {
    return {
      label: 'reclamacao',
      theme: null,
      summary: 'Classificado pelo NPS (detrator), sem comentário.',
      source: 'score',
    };
  }
  if (npsClass === NpsClass.passive) {
    return {
      label: 'neutro',
      theme: null,
      summary: 'Classificado pelo NPS (passivo), sem comentário.',
      source: 'score',
    };
  }
  return null;
}

export function skippedWithoutSignal(): ClassificationResult {
  return {
    label: 'neutro',
    theme: null,
    summary: 'Sem comentário e sem nota NPS para classificar.',
    source: 'skipped',
  };
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error('empty_model_output');
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const text = (fence ? fence[1] : trimmed).trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start)
    throw new Error('invalid_json');
  return JSON.parse(text.slice(start, end + 1)) as unknown;
}

export function parseGroqClassification(raw: string): ClassificationResult {
  const parsed = extractJsonObject(raw);
  if (!parsed || typeof parsed !== 'object') throw new Error('invalid_payload');
  const obj = parsed as Record<string, unknown>;
  const label = mapSentimentLabel(
    obj.label ?? obj.sentiment ?? obj.classificacao,
  );
  const theme = normalizeTheme(
    obj.theme ?? obj.tema ?? obj.category ?? obj.categoria,
  );
  const summary = clampSummary(obj.summary ?? obj.resumo ?? obj.sinopse);
  return { label, theme, summary, source: 'groq' };
}

export function buildGroqUserPrompt(params: {
  comment: string;
  npsScore?: number | null;
  npsClass?: string | null;
}): string {
  const scoreLine =
    typeof params.npsScore === 'number'
      ? `Nota NPS: ${params.npsScore}${params.npsClass ? ` (${params.npsClass})` : ''}`
      : 'Nota NPS: (não informada)';
  return [
    'Classifique o feedback de pesquisa abaixo.',
    scoreLine,
    'Comentário:',
    params.comment,
  ].join('\n');
}

export const GROQ_SYSTEM_PROMPT = [
  'Você classifica feedbacks de pesquisas de satisfação em português do Brasil.',
  'Responda SOMENTE um JSON válido, sem markdown, no formato:',
  '{"label":"elogio"|"reclamacao"|"neutro","theme":"atendimento"|"espera"|"comida"|"preco"|"limpeza"|"qualidade"|"ambiente"|"entrega"|"produto"|"outro","summary":"frase curta"}',
  'label: elogio se o texto elogia; reclamacao se reclama ou critica; neutro se for misto, vago ou só descritivo.',
  'theme: escolha o tema principal entre as opções. Use outro se nenhum se aplicar.',
  'summary: uma frase em português, até 140 caracteres, sem quebra de linha.',
].join(' ');
