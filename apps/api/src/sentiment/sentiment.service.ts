import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GroqClient } from './groq.client';
import {
  classifyFromScore,
  collectCommentText,
  hasUsableComment,
  parseGroqClassification,
  skippedWithoutSignal,
  type ClassificationResult,
} from '../domain/sentiment/classify';

const MAX_ATTEMPTS = 8;
const PROCESSOR_BATCH = 5;
const ENDPOINT_BATCH_MAX = 20;
const MISSING_KEY_RETRY_MS = 15 * 60 * 1000;
const BACKOFF_MINUTES = [1, 2, 5, 15, 30, 60, 120, 240];

export type ClassifyOutcome = 'classified' | 'skipped' | 'retry' | 'ignored';

@Injectable()
export class SentimentService {
  private readonly logger = new Logger(SentimentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly groq: GroqClient,
  ) {}

  isGroqConfigured(): boolean {
    return this.groq.isConfigured();
  }

  classifyLater(tenantId: string, responseId: string) {
    setImmediate(() => {
      this.classifyResponse(tenantId, responseId).catch((err: unknown) => {
        this.logger.warn(
          `classifyLater failed tenant=${tenantId} response=${responseId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    });
  }

  async classifyResponse(
    tenantId: string,
    responseId: string,
  ): Promise<ClassifyOutcome> {
    const row = await this.prisma.surveyResponse.findFirst({
      where: { id: responseId, tenantId, status: 'completed' },
      select: {
        id: true,
        tenantId: true,
        sentiment: true,
        npsScore: true,
        npsClass: true,
        mainComment: true,
        sentimentAttempts: true,
        answers: { select: { value: true } },
      },
    });

    if (!row) return 'ignored';
    if (row.sentiment) return 'ignored';

    const comment = collectCommentText({
      mainComment: row.mainComment,
      answers: row.answers,
    });

    if (!hasUsableComment(comment)) {
      const fallback =
        classifyFromScore(row.npsClass) ?? skippedWithoutSignal();
      await this.persistSuccess(tenantId, responseId, fallback);
      return fallback.source === 'skipped' ? 'skipped' : 'classified';
    }

    if (!this.groq.isConfigured()) {
      await this.markRetry(
        tenantId,
        responseId,
        row.sentimentAttempts,
        'missing_api_key',
        {
          incrementAttempts: false,
          retryInMs: MISSING_KEY_RETRY_MS,
        },
      );
      return 'retry';
    }

    try {
      const raw = await this.groq.classifyFeedback({
        comment,
        npsScore: row.npsScore,
        npsClass: row.npsClass,
      });
      const parsed = parseGroqClassification(raw);
      await this.persistSuccess(tenantId, responseId, parsed);
      return 'classified';
    } catch (err: unknown) {
      const message = (err instanceof Error ? err.message : String(err)).slice(
        0,
        500,
      );
      this.logger.warn(
        `Groq classify failed tenant=${tenantId} response=${responseId}: ${message}`,
      );
      await this.markRetry(
        tenantId,
        responseId,
        row.sentimentAttempts,
        message,
        {
          incrementAttempts: true,
        },
      );
      return 'retry';
    }
  }

  async processPendingBatch(opts?: {
    tenantId?: string;
    limit?: number;
  }): Promise<{
    processed: number;
    classified: number;
    skipped: number;
    failed: number;
  }> {
    const limit = Math.max(
      1,
      Math.min(ENDPOINT_BATCH_MAX, opts?.limit ?? PROCESSOR_BATCH),
    );
    const now = new Date();
    const where: Prisma.SurveyResponseWhereInput = {
      status: 'completed',
      sentiment: null,
      sentimentAttempts: { lt: MAX_ATTEMPTS },
      OR: [
        { sentimentNextAttemptAt: null },
        { sentimentNextAttemptAt: { lte: now } },
      ],
      ...(opts?.tenantId ? { tenantId: opts.tenantId } : {}),
    };

    const rows = await this.prisma.surveyResponse.findMany({
      where,
      orderBy: [{ completedAt: 'desc' }, { startedAt: 'desc' }],
      take: limit,
      select: { id: true, tenantId: true },
    });

    let classified = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const outcome = await this.classifyResponse(row.tenantId, row.id);
        if (outcome === 'classified') classified += 1;
        else if (outcome === 'skipped' || outcome === 'ignored') skipped += 1;
        else failed += 1;
      } catch {
        failed += 1;
      }
      if (i < rows.length - 1) await sleep(250);
    }

    return { processed: rows.length, classified, skipped, failed };
  }

  private async persistSuccess(
    tenantId: string,
    responseId: string,
    result: ClassificationResult,
  ) {
    await this.prisma.surveyResponse.updateMany({
      where: { id: responseId, tenantId, sentiment: null },
      data: {
        sentiment: result.label,
        sentimentTheme: result.theme,
        sentimentSummary: result.summary,
        sentimentSource: result.source,
        sentimentClassifiedAt: new Date(),
        sentimentLastError: null,
        sentimentNextAttemptAt: null,
      },
    });
  }

  private async markRetry(
    tenantId: string,
    responseId: string,
    currentAttempts: number,
    error: string,
    opts: { incrementAttempts: boolean; retryInMs?: number },
  ) {
    const attempts = opts.incrementAttempts
      ? currentAttempts + 1
      : currentAttempts;
    const retryInMs =
      opts.retryInMs ??
      BACKOFF_MINUTES[Math.min(attempts, BACKOFF_MINUTES.length - 1)] * 60_000;
    await this.prisma.surveyResponse.updateMany({
      where: { id: responseId, tenantId, sentiment: null },
      data: {
        sentimentAttempts: attempts,
        sentimentLastError: error.slice(0, 500),
        sentimentNextAttemptAt: new Date(Date.now() + retryInMs),
      },
    });
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
