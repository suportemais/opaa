import { Injectable, Logger } from '@nestjs/common';
import { SentimentService } from './sentiment.service';

@Injectable()
export class SentimentProcessor {
  private readonly logger = new Logger(SentimentProcessor.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private stopped = false;
  private readonly intervalMs = 20_000;

  constructor(private readonly sentiment: SentimentService) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
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
    this.timer = setTimeout(() => void this.tick(), 8_000);
  }

  private async tick() {
    if (this.stopped) return;
    if (!this.running) {
      this.running = true;
      try {
        const res = await this.sentiment.processPendingBatch({ limit: 5 });
        if (res.processed > 0) {
          this.logger.log(
            `Sentiment tick: processed=${res.processed} classified=${res.classified} skipped=${res.skipped} failed=${res.failed}`,
          );
        }
      } catch (err: unknown) {
        this.logger.error(
          `Sentiment tick error: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        this.running = false;
      }
    }
    if (!this.stopped) {
      this.timer = setTimeout(() => void this.tick(), this.intervalMs);
    }
  }
}
