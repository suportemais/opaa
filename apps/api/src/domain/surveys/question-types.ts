export const PRIMARY_RATING_QUESTION_TYPE = 'nps' as const;

export const OPEN_EXTRA_QUESTION_TYPES = ['text_long', 'text_short'] as const;
export const SCALE_EXTRA_QUESTION_TYPE = 'scale_1_10' as const;
export const MULTIPLE_CHOICE_QUESTION_TYPE = 'multiple_choice' as const;

export const DEFAULT_EXTRA_QUESTION_TYPE = 'text_long' as const;
export const DEFAULT_EXTRA_QUESTION_KIND = 'open' as const;

export const EXTRA_QUESTION_KINDS = ['open', 'scale_1_10'] as const;
export type ExtraQuestionKind = (typeof EXTRA_QUESTION_KINDS)[number];

export const EXTRA_QUESTION_KIND_LABELS = {
  open: 'Aberta',
  scale_1_10: 'Classificação 1–10',
} as const;

export const EXTRA_QUESTION_TYPE_MICROCOPY = 'Escolha o tipo da pergunta.';

export const SURVEY_QUESTION_TYPES = [
  PRIMARY_RATING_QUESTION_TYPE,
  ...OPEN_EXTRA_QUESTION_TYPES,
  SCALE_EXTRA_QUESTION_TYPE,
  MULTIPLE_CHOICE_QUESTION_TYPE,
] as const;

export type SurveyQuestionType = (typeof SURVEY_QUESTION_TYPES)[number];

export type QuestionTypeValidationCode =
  'nps_required_first' | 'nps_required_single' | 'invalid_extra_question_type';

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

export function isAllowedExtraQuestionType(type: string): boolean {
  return (
    isOpenExtraQuestionType(type) ||
    isScaleExtraQuestionType(type) ||
    type === MULTIPLE_CHOICE_QUESTION_TYPE
  );
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
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 10
  );
}

export function isAnswerMissing(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (typeof value === 'number') return !Number.isFinite(value);
  return false;
}

export function isPresentAnswerValidForType(
  type: string,
  value: unknown,
): boolean {
  if (isAnswerMissing(value)) return false;
  if (isScaleQuestionType(type)) return isScaleScore(value);
  if (isOpenExtraQuestionType(type))
    return typeof value === 'string' && value.trim().length > 0;
  return true;
}

export function validateSurveyQuestionTypes(
  questions: Array<{ type: string }>,
): { ok: true } | { ok: false; code: QuestionTypeValidationCode } {
  const npsIndex = questions.findIndex((q) => isPrimaryRatingType(q.type));
  if (npsIndex !== 0) return { ok: false, code: 'nps_required_first' };
  if (questions.filter((q) => isPrimaryRatingType(q.type)).length !== 1) {
    return { ok: false, code: 'nps_required_single' };
  }
  for (const q of questions.slice(1)) {
    if (!isAllowedExtraQuestionType(q.type)) {
      return { ok: false, code: 'invalid_extra_question_type' };
    }
  }
  return { ok: true };
}
