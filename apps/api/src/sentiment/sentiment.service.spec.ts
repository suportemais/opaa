import { SentimentService } from './sentiment.service';

describe('SentimentService', () => {
  function setup(row: Record<string, unknown> | null) {
    const findFirst = jest.fn().mockResolvedValue(row);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const groq = {
      isConfigured: jest.fn().mockReturnValue(true),
      classifyFeedback: jest.fn(),
    };
    const service = new SentimentService(
      { surveyResponse: { findFirst, updateMany } } as never,
      groq as never,
    );
    return { service, findFirst, updateMany, groq };
  }

  it('tags score-only responses without calling Groq', async () => {
    const { service, updateMany, groq } = setup({
      id: 'r1',
      tenantId: 't1',
      sentiment: null,
      npsScore: 10,
      npsClass: 'promoter',
      mainComment: null,
      sentimentAttempts: 0,
      answers: [{ value: 10 }],
    });

    await expect(service.classifyResponse('t1', 'r1')).resolves.toBe('classified');
    expect(groq.classifyFeedback).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'r1', tenantId: 't1', sentiment: null },
        data: expect.objectContaining({
          sentiment: 'elogio',
          sentimentSource: 'score',
        }),
      }),
    );
  });

  it('persists Groq mapping for comments', async () => {
    const { service, updateMany, groq } = setup({
      id: 'r1',
      tenantId: 't1',
      sentiment: null,
      npsScore: 3,
      npsClass: 'detractor',
      mainComment: 'A fila estava enorme',
      sentimentAttempts: 0,
      answers: [],
    });
    groq.classifyFeedback.mockResolvedValue(
      '{"label":"reclamacao","theme":"espera","summary":"Reclamou da espera."}',
    );

    await expect(service.classifyResponse('t1', 'r1')).resolves.toBe('classified');
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sentiment: 'reclamacao',
          sentimentTheme: 'espera',
          sentimentSummary: 'Reclamou da espera.',
          sentimentSource: 'groq',
        }),
      }),
    );
  });

  it('leaves the survey saved and retries later when Groq fails', async () => {
    const { service, updateMany, groq } = setup({
      id: 'r1',
      tenantId: 't1',
      sentiment: null,
      npsScore: 3,
      npsClass: 'detractor',
      mainComment: 'Péssimo atendimento',
      sentimentAttempts: 0,
      answers: [],
    });
    groq.classifyFeedback.mockRejectedValue(new Error('timeout'));

    await expect(service.classifyResponse('t1', 'r1')).resolves.toBe('retry');
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'r1', tenantId: 't1', sentiment: null },
        data: expect.objectContaining({
          sentimentAttempts: 1,
          sentimentLastError: 'timeout',
        }),
      }),
    );
    expect(updateMany.mock.calls[0][0].data.sentiment).toBeUndefined();
  });

  it('does not classify a response from another tenant', async () => {
    const { service, updateMany } = setup(null);
    await expect(service.classifyResponse('tenant-b', 'r1')).resolves.toBe('ignored');
    expect(updateMany).not.toHaveBeenCalled();
  });
});
