export const PRIMARY_RATING_QUESTION_TYPE = 'nps' as const;
export const SCALE_EXTRA_QUESTION_TYPE = 'scale_1_10' as const;
export const DEFAULT_EXTRA_QUESTION_TYPE = 'text_long' as const;
export const DEFAULT_EXTRA_QUESTION_KIND = 'open' as const;

export const EXTRA_QUESTION_KINDS = ['open', 'scale_1_10'] as const;
export type ExtraQuestionKind = (typeof EXTRA_QUESTION_KINDS)[number];

export const EXTRA_QUESTION_KIND_LABELS = {
  open: 'Aberta',
  scale_1_10: 'Classificação 1–10',
} as const;

export const EXTRA_QUESTION_TYPE_MICROCOPY = 'Escolha o tipo da pergunta.';

export function isPrimaryRatingType(type: string): boolean {
  return type === PRIMARY_RATING_QUESTION_TYPE;
}

export function isOpenExtraQuestionType(type: string): boolean {
  return type === 'text_long' || type === 'text_short';
}

export function isScaleExtraQuestionType(type: string): boolean {
  return type === SCALE_EXTRA_QUESTION_TYPE;
}

export function extraQuestionKindFromType(type: string): ExtraQuestionKind {
  return isScaleExtraQuestionType(type) ? 'scale_1_10' : 'open';
}

export function persistedTypeFromExtraKind(
  kind: ExtraQuestionKind,
  existingType?: string,
): string {
  if (kind === 'scale_1_10') return SCALE_EXTRA_QUESTION_TYPE;
  if (existingType === 'text_short') return 'text_short';
  return DEFAULT_EXTRA_QUESTION_TYPE;
}

export function isScaleScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 10;
}

export function isAnswerMissing(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (typeof value === 'number') return !Number.isFinite(value);
  return false;
}
