import {
  DEFAULT_EXTRA_QUESTION_KIND,
  DEFAULT_EXTRA_QUESTION_TYPE,
  EXTRA_QUESTION_KIND_LABELS,
  EXTRA_QUESTION_TYPE_MICROCOPY,
  extraQuestionKindFromType,
  isPresentAnswerValidForType,
  isScaleScore,
  persistedTypeFromExtraKind,
  validateSurveyQuestionTypes,
} from './question-types';

describe('extra survey question types', () => {
  it('defaults extras to open/aberta and keeps locked copy', () => {
    expect(DEFAULT_EXTRA_QUESTION_KIND).toBe('open');
    expect(DEFAULT_EXTRA_QUESTION_TYPE).toBe('text_long');
    expect(extraQuestionKindFromType('text_long')).toBe('open');
    expect(extraQuestionKindFromType('text_short')).toBe('open');
    expect(extraQuestionKindFromType('unknown')).toBe('open');
    expect(extraQuestionKindFromType('scale_1_10')).toBe('scale_1_10');
    expect(EXTRA_QUESTION_KIND_LABELS.open).toBe('Aberta');
    expect(EXTRA_QUESTION_KIND_LABELS.scale_1_10).toBe('Classificação 1–10');
    expect(EXTRA_QUESTION_TYPE_MICROCOPY).toBe('Escolha o tipo da pergunta.');
  });

  it('preserves existing open types when remapping the extra kind', () => {
    expect(persistedTypeFromExtraKind('open')).toBe('text_long');
    expect(persistedTypeFromExtraKind('open', 'text_short')).toBe('text_short');
    expect(persistedTypeFromExtraKind('open', 'scale_1_10')).toBe('text_long');
    expect(persistedTypeFromExtraKind('scale_1_10', 'text_long')).toBe(
      'scale_1_10',
    );
  });

  it('requires a single primary nps question first and allows extra scale', () => {
    expect(validateSurveyQuestionTypes([])).toEqual({
      ok: false,
      code: 'nps_required_first',
    });
    expect(validateSurveyQuestionTypes([{ type: 'text_long' }])).toEqual({
      ok: false,
      code: 'nps_required_first',
    });
    expect(
      validateSurveyQuestionTypes([{ type: 'nps' }, { type: 'nps' }]),
    ).toEqual({ ok: false, code: 'nps_required_single' });
    expect(
      validateSurveyQuestionTypes([{ type: 'nps' }, { type: 'rating' }]),
    ).toEqual({ ok: false, code: 'invalid_extra_question_type' });
    expect(
      validateSurveyQuestionTypes([
        { type: 'nps' },
        { type: 'text_long' },
        { type: 'scale_1_10' },
        { type: 'text_short' },
      ]),
    ).toEqual({ ok: true });
  });

  it('accepts 1–10 integers for scale answers and text for open answers', () => {
    expect(isScaleScore(1)).toBe(true);
    expect(isScaleScore(10)).toBe(true);
    expect(isScaleScore(0)).toBe(false);
    expect(isScaleScore(11)).toBe(false);
    expect(isScaleScore(7.5)).toBe(false);
    expect(isScaleScore('8')).toBe(false);
    expect(isPresentAnswerValidForType('scale_1_10', 8)).toBe(true);
    expect(isPresentAnswerValidForType('nps', 3)).toBe(true);
    expect(isPresentAnswerValidForType('scale_1_10', 0)).toBe(false);
    expect(isPresentAnswerValidForType('text_long', '  ok  ')).toBe(true);
    expect(isPresentAnswerValidForType('text_short', '   ')).toBe(false);
    expect(isPresentAnswerValidForType('text_long', 8)).toBe(false);
  });
});
