import {
  Global,
  Module,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { GroqClient } from './groq.client';
import { SentimentService } from './sentiment.service';
import { SentimentProcessor } from './sentiment.processor';

@Global()
@Module({
  providers: [GroqClient, SentimentService, SentimentProcessor],
  exports: [SentimentService, GroqClient],
})
export class SentimentModule
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  constructor(private readonly processor: SentimentProcessor) {}

  onApplicationBootstrap() {
    this.processor.onModuleInit();
  }

  onApplicationShutdown() {
    this.processor.onModuleDestroy();
  }
}
