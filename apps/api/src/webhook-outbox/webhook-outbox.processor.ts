import { Injectable, Logger } from '@nestjs/common';
import { WebhookOutboxService } from './webhook-outbox.service';

@Injectable()
export class WebhookOutboxProcessor {
  private readonly logger = new Logger(WebhookOutboxProcessor.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private stopped = false;
  private readonly intervalMs = 15_000;

  constructor(private readonly outbox: WebhookOutboxService) {}

  onModuleInit() {
    this.start();
  }

  onModuleDestroy() {
    this.stopped = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  start() {
    if (this.timer) return;
    this.timer = setTimeout(() => void this.tick(), this.intervalMs);
  }

  private async tick() {
    if (this.stopped) return;
    if (!this.running) {
      this.running = true;
      try {
        const res = await this.outbox.processBatch();
        if (res.processed > 0) {
          this.logger.log(`Webhook outbox tick: processed=${res.processed}, sent=${res.sent}, failed=${res.failed}`);
        }
      } catch (err: unknown) {
        this.logger.error(`Webhook outbox tick error: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        this.running = false;
      }
    }
    if (!this.stopped) {
      this.timer = setTimeout(() => void this.tick(), this.intervalMs);
    }
  }
}
