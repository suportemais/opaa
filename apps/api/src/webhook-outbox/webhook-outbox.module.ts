import { Global, Module, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { WebhookOutboxService } from './webhook-outbox.service';
import { WebhookOutboxProcessor } from './webhook-outbox.processor';

@Global()
@Module({
  providers: [WebhookOutboxService, WebhookOutboxProcessor],
  exports: [WebhookOutboxService],
})
export class WebhookOutboxModule implements OnApplicationBootstrap, OnApplicationShutdown {
  constructor(private readonly processor: WebhookOutboxProcessor) {}

  onApplicationBootstrap() {
    this.processor.onModuleInit();
  }

  onApplicationShutdown() {
    this.processor.onModuleDestroy();
  }
}
