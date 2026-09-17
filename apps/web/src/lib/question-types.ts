export const PRIMARY_RATING_QUESTION_TYPE = 'nps' as const;
export const SCALE_EXTRA_QUESTION_TYPE = 'scale_1_10' as const;
export const THUMBS_QUESTION_TYPE = 'thumbs' as const;
export const STARS_QUESTION_TYPE = 'stars_1_5' as const;
export const SINGLE_CHOICE_QUESTION_TYPE = 'single_choice' as const;
export const MULTIPLE_CHOICE_QUESTION_TYPE = 'multiple_choice' as const;
export const DEFAULT_EXTRA_QUESTION_TYPE = 'text_long' as const;
export const DEFAULT_EXTRA_QUESTION_KIND = 'open' as const;

export const EXTRA_QUESTION_KINDS = [
  'open',
  'scale_1_10',
  'thumbs',
  'stars_1_5',
  'single_choice',
] as const;
export type ExtraQuestionKind = (typeof EXTRA_QUESTION_KINDS)[number];

export const EXTRA_QUESTION_KIND_LABELS = {
  open: 'Aberta',
  scale_1_10: 'Classificação 1–10',
  thumbs: 'Polegar',
  stars_1_5: 'Estrelas (1–5)',
  single_choice: 'Escolha única',
} as const;

export const EXTRA_QUESTION_TYPE_MICROCOPY = 'Escolha o tipo da pergunta.';

export const WHY_FOLLOWUP_QUESTION = 'Por quê?';
export const WHY_FOLLOWUP_PLACEHOLDER = 'Conta pra gente o que motivou essa resposta';
export const WHY_FOLLOWUP_MICROCOPY = 'Sua resposta ajuda a gente a melhorar';

export const WHY_THRESHOLD_STARS = 3;
export const WHY_THRESHOLD_SCALE = 6;

export const THUMBS_UP = 'up' as const;
export const THUMBS_DOWN = 'down' as const;

export type PackedAnswerValue = {
  value: unknown;
  why?: string;
  label?: string;
};

export function isPrimaryRatingType(type: string): boolean {
  return type === PRIMARY_RATING_QUESTION_TYPE;
}

export function isOpenExtraQuestionType(type: string): boolean {
  return type === 'text_long' || type === 'text_short';
}

export function isScaleExtraQuestionType(type: string): boolean {
  return type === SCALE_EXTRA_QUESTION_TYPE;
}

export function isScaleQuestionType(type: string): boolean {
  return isPrimaryRatingType(type) || isScaleExtraQuestionType(type);
}

export function isThumbsQuestionType(type: string): boolean {
  return type === THUMBS_QUESTION_TYPE;
}

export function isStarsQuestionType(type: string): boolean {
  return type === STARS_QUESTION_TYPE;
}

export function isSingleChoiceQuestionType(type: string): boolean {
  return type === SINGLE_CHOICE_QUESTION_TYPE || type === MULTIPLE_CHOICE_QUESTION_TYPE;
}

export function extraQuestionKindFromType(type: string): ExtraQuestionKind {
  if (isScaleExtraQuestionType(type)) return 'scale_1_10';
  if (isThumbsQuestionType(type)) return 'thumbs';
  if (isStarsQuestionType(type)) return 'stars_1_5';
  if (isSingleChoiceQuestionType(type)) return 'single_choice';
  return 'open';
}

export function persistedTypeFromExtraKind(
  kind: ExtraQuestionKind,
  existingType?: string,
): string {
  if (kind === 'scale_1_10') return SCALE_EXTRA_QUESTION_TYPE;
  if (kind === 'thumbs') return THUMBS_QUESTION_TYPE;
  if (kind === 'stars_1_5') return STARS_QUESTION_TYPE;
  if (kind === 'single_choice') {
    if (existingType === MULTIPLE_CHOICE_QUESTION_TYPE) return MULTIPLE_CHOICE_QUESTION_TYPE;
    return SINGLE_CHOICE_QUESTION_TYPE;
  }
  if (existingType === 'text_short') return 'text_short';
  return DEFAULT_EXTRA_QUESTION_TYPE;
}

export function isPackedAnswerValue(value: unknown): value is PackedAnswerValue {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function unwrapAnswerValue(raw: unknown): unknown {
  if (isPackedAnswerValue(raw) && 'value' in raw) return raw.value;
  return raw;
}

export function unwrapAnswerWhy(raw: unknown): string | undefined {
  if (!isPackedAnswerValue(raw) || typeof raw.why !== 'string') return undefined;
  const why = raw.why.trim();
  return why.length > 0 ? why : undefined;
}

export function unwrapAnswerLabel(raw: unknown): string | undefined {
  if (!isPackedAnswerValue(raw) || typeof raw.label !== 'string') return undefined;
  const label = raw.label.trim();
  return label.length > 0 ? label : undefined;
}

export function packAnswerValue(
  value: unknown,
  extras?: { why?: string; label?: string },
): unknown {
  const why = typeof extras?.why === 'string' && extras.why.trim().length > 0 ? extras.why.trim() : undefined;
  const label =
    typeof extras?.label === 'string' && extras.label.trim().length > 0 ? extras.label.trim() : undefined;
  if (!why && !label) return value;
  return { value, ...(label ? { label } : {}), ...(why ? { why } : {}) };
}

export function isScaleScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 10;
}

export function isStarsScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
}

export function isThumbsValue(value: unknown): value is 'up' | 'down' {
  return value === THUMBS_UP || value === THUMBS_DOWN;
}

export function extractScaleScore(raw: unknown): number | null {
  const value = unwrapAnswerValue(raw);
  return isScaleScore(value) ? value : null;
}

export function isAnswerMissing(value: unknown): boolean {
  const inner = unwrapAnswerValue(value);
  if (inner === undefined || inner === null) return true;
  if (typeof inner === 'string') return inner.trim().length === 0;
  if (typeof inner === 'number') return !Number.isFinite(inner);
  return false;
}

export function isPresentAnswerValidForType(type: string, value: unknown): boolean {
  if (isAnswerMissing(value)) return false;
  const inner = unwrapAnswerValue(value);
  if (isScaleQuestionType(type)) return isScaleScore(inner);
  if (isStarsQuestionType(type)) return isStarsScore(inner);
  if (isThumbsQuestionType(type)) return isThumbsValue(inner);
  if (isOpenExtraQuestionType(type) || isSingleChoiceQuestionType(type)) {
    return typeof inner === 'string' && inner.trim().length > 0;
  }
  return true;
}

export function shouldShowWhyFollowUp(params: {
  type: string;
  value: unknown;
  options?: Array<{ value: string; negative?: boolean }>;
}): boolean {
  const inner = unwrapAnswerValue(params.value);
  if (isAnswerMissing(inner)) return false;
  if (isThumbsQuestionType(params.type)) return inner === THUMBS_DOWN;
  if (isStarsQuestionType(params.type)) return isStarsScore(inner) && inner <= WHY_THRESHOLD_STARS;
  if (isScaleQuestionType(params.type)) return isScaleScore(inner) && inner <= WHY_THRESHOLD_SCALE;
  if (isSingleChoiceQuestionType(params.type)) {
    if (typeof inner !== 'string') return false;
    return Boolean(params.options?.some((o) => o.value === inner && o.negative === true));
  }
  return false;
}

export function formatAnswerDisplay(type: string, raw: unknown): string {
  const inner = unwrapAnswerValue(raw);
  const why = unwrapAnswerWhy(raw);
  const label = unwrapAnswerLabel(raw);
  let main = '';
  if (isThumbsQuestionType(type)) {
    if (inner === THUMBS_UP) main = '👍';
    else if (inner === THUMBS_DOWN) main = '👎';
    else main = inner == null ? '' : String(inner);
  } else if (isStarsQuestionType(type) && isStarsScore(inner)) {
    main = `${inner} de 5`;
  } else if (isSingleChoiceQuestionType(type)) {
    main = label || (typeof inner === 'string' ? inner : inner == null ? '' : String(inner));
  } else if (typeof inner === 'string' || typeof inner === 'number') {
    main = String(inner);
  } else if (inner == null) {
    main = '';
  } else {
    main = JSON.stringify(inner);
  }
  if (why) return main ? `${main}\n${WHY_FOLLOWUP_QUESTION} ${why}` : `${WHY_FOLLOWUP_QUESTION} ${why}`;
  return main;
}
