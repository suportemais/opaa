import {
  DEFAULT_EXTRA_QUESTION_KIND,
  DEFAULT_EXTRA_QUESTION_TYPE,
  EXTRA_QUESTION_KIND_LABELS,
  EXTRA_QUESTION_TYPE_MICROCOPY,
  WHY_FOLLOWUP_MICROCOPY,
  WHY_FOLLOWUP_PLACEHOLDER,
  WHY_FOLLOWUP_QUESTION,
  extraQuestionKindFromType,
  extractScaleScore,
  isPresentAnswerValidForType,
  isScaleScore,
  normalizeQuestionOptions,
  packAnswerValue,
  persistedTypeFromExtraKind,
  shouldShowWhyFollowUp,
  unwrapAnswerValue,
  unwrapAnswerWhy,
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
    expect(extraQuestionKindFromType('thumbs')).toBe('thumbs');
    expect(extraQuestionKindFromType('stars_1_5')).toBe('stars_1_5');
    expect(extraQuestionKindFromType('single_choice')).toBe('single_choice');
    expect(extraQuestionKindFromType('multiple_choice')).toBe('single_choice');
    expect(EXTRA_QUESTION_KIND_LABELS.open).toBe('Aberta');
    expect(EXTRA_QUESTION_KIND_LABELS.scale_1_10).toBe('Classificação 1–10');
    expect(EXTRA_QUESTION_KIND_LABELS.thumbs).toBe('Polegar');
    expect(EXTRA_QUESTION_KIND_LABELS.stars_1_5).toBe('Estrelas (1–5)');
    expect(EXTRA_QUESTION_KIND_LABELS.single_choice).toBe('Escolha única');
    expect(EXTRA_QUESTION_TYPE_MICROCOPY).toBe('Escolha o tipo da pergunta.');
  });

  it('preserves existing open types when remapping the extra kind', () => {
    expect(persistedTypeFromExtraKind('open')).toBe('text_long');
    expect(persistedTypeFromExtraKind('open', 'text_short')).toBe('text_short');
    expect(persistedTypeFromExtraKind('open', 'scale_1_10')).toBe('text_long');
    expect(persistedTypeFromExtraKind('scale_1_10', 'text_long')).toBe(
      'scale_1_10',
    );
    expect(persistedTypeFromExtraKind('thumbs')).toBe('thumbs');
    expect(persistedTypeFromExtraKind('stars_1_5')).toBe('stars_1_5');
    expect(persistedTypeFromExtraKind('single_choice')).toBe('single_choice');
    expect(persistedTypeFromExtraKind('single_choice', 'multiple_choice')).toBe(
      'multiple_choice',
    );
  });

  it('requires a single primary nps question first and allows extra types', () => {
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
      validateSurveyQuestionTypes([{ type: 'nps' }, { type: 'single_choice' }]),
    ).toEqual({ ok: false, code: 'single_choice_options_required' });
    expect(
      validateSurveyQuestionTypes([
        { type: 'nps' },
        { type: 'text_long' },
        { type: 'scale_1_10' },
        { type: 'text_short' },
        { type: 'thumbs' },
        { type: 'stars_1_5' },
        {
          type: 'single_choice',
          options: [{ label: 'Sim' }, { label: 'Não', negative: true }],
        },
      ]),
    ).toEqual({ ok: true });
  });

  it('accepts answers consistent with each extra type', () => {
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
    expect(isPresentAnswerValidForType('thumbs', 'up')).toBe(true);
    expect(isPresentAnswerValidForType('thumbs', 'down')).toBe(true);
    expect(isPresentAnswerValidForType('thumbs', 'maybe')).toBe(false);
    expect(isPresentAnswerValidForType('stars_1_5', 5)).toBe(true);
    expect(isPresentAnswerValidForType('stars_1_5', 0)).toBe(false);
    expect(isPresentAnswerValidForType('stars_1_5', 6)).toBe(false);
    expect(isPresentAnswerValidForType('single_choice', 'ruim')).toBe(true);
    expect(isPresentAnswerValidForType('single_choice', '')).toBe(false);
    expect(isPresentAnswerValidForType('nps', { value: 4, why: 'fila' })).toBe(
      true,
    );
    expect(extractScaleScore({ value: 6, why: 'demora' })).toBe(6);
  });

  it('packs and unwraps why answers without breaking primitives', () => {
    expect(packAnswerValue(8)).toBe(8);
    expect(packAnswerValue('up', { why: '  ' })).toBe('up');
    expect(packAnswerValue(3, { why: 'fria' })).toEqual({
      value: 3,
      why: 'fria',
    });
    expect(unwrapAnswerValue({ value: 'down', why: 'demora' })).toBe('down');
    expect(unwrapAnswerWhy({ value: 'down', why: 'demora' })).toBe('demora');
    expect(unwrapAnswerWhy(8)).toBeUndefined();
  });

  it('shows Por quê? only for locked non-positive thresholds', () => {
    expect(WHY_FOLLOWUP_QUESTION).toBe('Por quê?');
    expect(WHY_FOLLOWUP_PLACEHOLDER).toBe(
      'Conta pra gente o que motivou essa resposta',
    );
    expect(WHY_FOLLOWUP_MICROCOPY).toBe(
      'Sua resposta ajuda a gente a melhorar',
    );
    expect(shouldShowWhyFollowUp({ type: 'thumbs', value: 'down' })).toBe(true);
    expect(shouldShowWhyFollowUp({ type: 'thumbs', value: 'up' })).toBe(false);
    expect(shouldShowWhyFollowUp({ type: 'stars_1_5', value: 3 })).toBe(true);
    expect(shouldShowWhyFollowUp({ type: 'stars_1_5', value: 4 })).toBe(false);
    expect(shouldShowWhyFollowUp({ type: 'scale_1_10', value: 6 })).toBe(true);
    expect(shouldShowWhyFollowUp({ type: 'nps', value: 6 })).toBe(true);
    expect(shouldShowWhyFollowUp({ type: 'nps', value: 7 })).toBe(false);
    expect(
      shouldShowWhyFollowUp({
        type: 'single_choice',
        value: 'ruim',
        options: [
          { value: 'bom', negative: false },
          { value: 'ruim', negative: true },
        ],
      }),
    ).toBe(true);
    expect(
      shouldShowWhyFollowUp({
        type: 'single_choice',
        value: 'bom',
        options: [
          { value: 'bom', negative: false },
          { value: 'ruim', negative: true },
        ],
      }),
    ).toBe(false);
  });

  it('normalizes escolha única options and marks negatives', () => {
    expect(
      normalizeQuestionOptions([
        { label: 'Ótimo' },
        { label: '  Ruim  ', negative: true },
        { label: '   ' },
      ]),
    ).toEqual([
      { label: 'Ótimo', value: 'otimo', negative: false, order: 1 },
      { label: 'Ruim', value: 'ruim', negative: true, order: 2 },
    ]);
  });
});
