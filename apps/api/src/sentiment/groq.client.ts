import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { buildGroqUserPrompt, GROQ_SYSTEM_PROMPT } from '../domain/sentiment/classify';

const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1';
const DEFAULT_MODEL = 'openai/gpt-oss-20b';

@Injectable()
export class GroqClient {
  private readonly logger = new Logger(GroqClient.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey());
  }

  model(): string {
    return (this.config.get<string>('GROQ_MODEL') ?? DEFAULT_MODEL).trim() || DEFAULT_MODEL;
  }

  baseUrl(): string {
    return (this.config.get<string>('GROQ_BASE_URL') ?? DEFAULT_BASE_URL).trim() || DEFAULT_BASE_URL;
  }

  async classifyFeedback(params: {
    comment: string;
    npsScore?: number | null;
    npsClass?: string | null;
  }): Promise<string> {
    const apiKey = this.apiKey();
    if (!apiKey) throw new Error('missing_api_key');

    const client = new OpenAI({
      apiKey,
      baseURL: this.baseUrl(),
      timeout: 20_000,
      maxRetries: 0,
    });

    const completion = await client.chat.completions.create({
      model: this.model(),
      temperature: 0,
      max_tokens: 220,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: GROQ_SYSTEM_PROMPT },
        { role: 'user', content: buildGroqUserPrompt(params) },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content || !content.trim()) {
      this.logger.warn('Groq returned empty classification content');
      throw new Error('empty_model_output');
    }
    return content;
  }

  private apiKey(): string {
    return (this.config.get<string>('GROQ_API_KEY') ?? '').trim();
  }
}
