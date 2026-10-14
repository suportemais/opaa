import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private client: Stripe | null = null;

  constructor(private readonly config: ConfigService) {}

  isConfigured() {
    return Boolean(this.secretKey());
  }

  /** true quando a chave configurada é de teste (sk_test_/rk_test_). */
  isTestMode() {
    return /^(sk|rk)_test_/.test(this.secretKey());
  }

  get stripe(): Stripe {
    if (this.client) return this.client;
    const key = this.secretKey();
    if (!key) throw new ServiceUnavailableException('stripe_not_configured');
    this.client = new Stripe(key, {
      appInfo: { name: 'Opiina' },
      maxNetworkRetries: 2,
    });
    if (this.isTestMode()) this.logger.log('Stripe em modo de teste');
    return this.client;
  }

  /** Valida a assinatura do webhook e devolve o evento. Lança se for inválida. */
  constructEvent(rawBody: Buffer | string, signature: string): Stripe.Event {
    const secret = (this.config.get<string>('STRIPE_WEBHOOK_SECRET') ?? '').trim();
    if (!secret) throw new ServiceUnavailableException('stripe_webhook_not_configured');
    return this.stripe.webhooks.constructEvent(rawBody, signature, secret);
  }

  private secretKey() {
    return (this.config.get<string>('STRIPE_SECRET_KEY') ?? '').trim();
  }
}
