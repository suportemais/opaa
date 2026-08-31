import { NpsClass } from '@prisma/client';
import {
  classifyFromScore,
  clampSummary,
  collectCommentText,
  hasUsableComment,
  mapSentimentLabel,
  normalizeTheme,
  parseGroqClassification,
  skippedWithoutSignal,
} from './classify';
import { aggregateSentiment } from './aggregate';

describe('sentiment classifier mapping', () => {
  it('maps Portuguese and English labels to elogio/reclamacao/neutro', () => {
    expect(mapSentimentLabel('elogio')).toBe('elogio');
    expect(mapSentimentLabel('Elogio')).toBe('elogio');
    expect(mapSentimentLabel('praise')).toBe('elogio');
    expect(mapSentimentLabel('positivo')).toBe('elogio');
    expect(mapSentimentLabel('reclamação')).toBe('reclamacao');
    expect(mapSentimentLabel('Reclamacao')).toBe('reclamacao');
    expect(mapSentimentLabel('complaint')).toBe('reclamacao');
    expect(mapSentimentLabel('negativo')).toBe('reclamacao');
    expect(mapSentimentLabel('neutro')).toBe('neutro');
    expect(mapSentimentLabel('mixed')).toBe('neutro');
    expect(mapSentimentLabel(null)).toBe('neutro');
  });

  it('normalizes themes including aliases and accents', () => {
    expect(normalizeTheme('Atendimento')).toBe('atendimento');
    expect(normalizeTheme('preço')).toBe('preco');
    expect(normalizeTheme('fila')).toBe('espera');
    expect(normalizeTheme('delivery')).toBe('entrega');
    expect(normalizeTheme('algo aleatório')).toBe('outro');
    expect(normalizeTheme('')).toBe('outro');
  });

  it('parses Groq JSON including markdown fences and extra keys', () => {
    const raw = '```json\n{"label":"reclamação","theme":"espera","summary":"Demorou demais na fila.","extra":1}\n```';
    expect(parseGroqClassification(raw)).toEqual({
      label: 'reclamacao',
      theme: 'espera',
      summary: 'Demorou demais na fila.',
      source: 'groq',
    });
  });

  it('parses JSON preceded by chatter', () => {
    const raw = 'Aqui está o resultado: {"label":"elogio","tema":"comida","resumo":"Gostou do prato."}';
    expect(parseGroqClassification(raw)).toEqual({
      label: 'elogio',
      theme: 'comida',
      summary: 'Gostou do prato.',
      source: 'groq',
    });
  });

  it('throws on empty or invalid model output', () => {
    expect(() => parseGroqClassification('')).toThrow('empty_model_output');
    expect(() => parseGroqClassification('not json')).toThrow('invalid_json');
  });

  it('classifies score-only responses without calling Groq', () => {
    expect(classifyFromScore(NpsClass.promoter)?.label).toBe('elogio');
    expect(classifyFromScore(NpsClass.promoter)?.source).toBe('score');
    expect(classifyFromScore(NpsClass.detractor)?.label).toBe('reclamacao');
    expect(classifyFromScore(NpsClass.passive)?.label).toBe('neutro');
    expect(classifyFromScore(null)).toBeNull();
    expect(skippedWithoutSignal().source).toBe('skipped');
  });

  it('collects free-text answers and skips empty comments', () => {
    expect(hasUsableComment('  ')).toBe(false);
    expect(hasUsableComment('ok')).toBe(true);
    expect(
      collectCommentText({
        mainComment: 'Fila enorme',
        answers: [{ value: 'Fila enorme' }, { value: 9 }, { value: '  ' }, { value: 'Atendente rude' }],
      }),
    ).toBe('Fila enorme\nAtendente rude');
  });

  it('clamps summary to a single short line', () => {
    expect(clampSummary('  duas   linhas\nno texto  ')).toBe('duas linhas no texto');
    const long = 'x'.repeat(200);
    expect(clampSummary(long).length).toBeLessThanOrEqual(160);
  });
});

describe('sentiment dashboard aggregation', () => {
  it('counts labels, percentages and theme breakdown', () => {
    const result = aggregateSentiment([
      { sentiment: 'elogio', sentimentTheme: 'atendimento' },
      { sentiment: 'elogio', sentimentTheme: 'comida' },
      { sentiment: 'reclamacao', sentimentTheme: 'espera' },
      { sentiment: 'reclamacao', sentimentTheme: 'espera' },
      { sentiment: 'neutro', sentimentTheme: null },
      { sentiment: null, sentimentTheme: null },
    ]);

    expect(result.responses).toBe(6);
    expect(result.classified).toBe(5);
    expect(result.unclassified).toBe(1);
    expect(result.counts).toEqual({ elogio: 2, reclamacao: 2, neutro: 1 });
    expect(result.percents).toEqual({ elogio: 40, reclamacao: 40, neutro: 20 });
    expect(result.byTheme[0]).toEqual({
      theme: 'espera',
      total: 2,
      elogio: 0,
      reclamacao: 2,
      neutro: 0,
    });
    expect(result.byTheme.find((t) => t.theme === 'outro')?.neutro).toBe(1);
  });

  it('returns zeros when nothing is classified', () => {
    const result = aggregateSentiment([
      { sentiment: null, sentimentTheme: null },
      { sentiment: null, sentimentTheme: 'espera' },
    ]);
    expect(result.classified).toBe(0);
    expect(result.percents).toEqual({ elogio: 0, reclamacao: 0, neutro: 0 });
    expect(result.byTheme).toEqual([]);
  });

  it('does not mix unknown labels into counts', () => {
    const result = aggregateSentiment([{ sentiment: 'positive', sentimentTheme: 'atendimento' }]);
    expect(result.classified).toBe(0);
    expect(result.unclassified).toBe(1);
  });
});
