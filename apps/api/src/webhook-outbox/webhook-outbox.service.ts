import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

const MAX_BACKOFF_MINUTES = 60 * 4;

@Injectable()
export class WebhookOutboxService implements OnModuleInit {
  private readonly logger = new Logger(WebhookOutboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const url = this.config.get<string>('WEBHOOK_N8N_URL');
    if (!url) {
      this.logger.log('WEBHOOK_N8N_URL not set; webhook outbox processor is idle');
    }
  }

  private getEnabledAndConfig(): { enabled: boolean; url: string; token: string | null; timeoutMs: number; batchSize: number } {
    const enabledRaw = (this.config.get<string>('WEBHOOK_ENABLED') ?? 'true').trim();
    const enabled = enabledRaw !== '0' && enabledRaw.toLowerCase() !== 'false';
    const url = (this.config.get<string>('WEBHOOK_N8N_URL') ?? '').trim();
    const token = (this.config.get<string>('WEBHOOK_N8N_TOKEN') ?? '').trim();
    const timeoutMs = Math.max(1_000, Number(this.config.get<string>('WEBHOOK_TIMEOUT_MS') ?? '15000') || 15000);
    const batchSize = Math.max(1, Math.min(500, Number(this.config.get<string>('WEBHOOK_BATCH_SIZE') ?? '50') || 50));
    return { enabled: enabled && Boolean(url), url, token: token || null, timeoutMs, batchSize };
  }

  async enqueue(params: {
    tenantId: string | null;
    eventType: string;
    payload: unknown;
  }) {
    return this.prisma.webhookOutbox.create({
      data: {
        tenantId: params.tenantId,
        eventType: params.eventType,
        payload: params.payload as any,
        status: 'pending',
        attempts: 0,
        maxAttempts: 10,
        nextAttemptAt: new Date(),
      },
      select: { id: true, status: true, createdAt: true },
    });
  }

  async processBatch(): Promise<{ processed: number; sent: number; failed: number }> {
    const cfg = this.getEnabledAndConfig();
    if (!cfg.enabled) return { processed: 0, sent: 0, failed: 0 };

    const now = new Date();
    const rows = await this.prisma.webhookOutbox.findMany({
      where: {
        status: 'pending',
        nextAttemptAt: { lte: now },
        attempts: { lt: this.prisma.webhookOutbox.fields.maxAttempts },
      },
      orderBy: [{ nextAttemptAt: 'asc' }, { createdAt: 'asc' }],
      take: cfg.batchSize,
    });

    if (rows.length === 0) return { processed: 0, sent: 0, failed: 0 };

    let sent = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs);
        try {
          const headers: Record<string, string> = { 'content-type': 'application/json' };
          if (cfg.token) headers['x-webhook-token'] = cfg.token;

          const res = await fetch(cfg.url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              id: row.id,
              eventType: row.eventType,
              tenantId: row.tenantId ?? null,
              createdAt: row.createdAt.toISOString(),
              attemptsBefore: row.attempts,
              payload: row.payload,
            }),
            signal: controller.signal,
          });

          if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(`HTTP ${res.status} ${text.slice(0, 500)}`);
          }
        } finally {
          clearTimeout(timeout);
        }

        await this.prisma.webhookOutbox.update({
          where: { id: row.id },
          data: { status: 'sent', attempts: row.attempts + 1, sentAt: new Date(), lastError: null },
        });
        sent++;
      } catch (err: unknown) {
        failed++;
        const message = err instanceof Error ? err.message : String(err);
        const nextAttempts = row.attempts + 1;
        const isDead = nextAttempts >= row.maxAttempts;
        const backoff = Math.min(MAX_BACKOFF_MINUTES, Math.pow(2, Math.min(12, nextAttempts)));
        const nextAttemptAt = new Date(Date.now() + backoff * 60_000);
        try {
          await this.prisma.webhookOutbox.update({
            where: { id: row.id },
            data: {
              status: isDead ? 'dead' : 'pending',
              attempts: nextAttempts,
              nextAttemptAt,
              lastError: message,
            },
          });
        } catch (updateErr) {
          this.logger.error(`Failed to update outbox row ${row.id}: ${updateErr instanceof Error ? updateErr.message : String(updateErr)}`);
        }
        this.logger.warn(`Webhook outbox row ${row.id} failed (attempt ${nextAttempts}/${row.maxAttempts}): ${message}`);
      }
    }

    return { processed: rows.length, sent, failed };
  }
}
