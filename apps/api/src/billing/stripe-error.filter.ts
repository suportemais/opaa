import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import type { Response } from 'express';
import Stripe from 'stripe';

/**
 * Erros da API da Stripe (chave inválida, preço inexistente, rede) não podem
 * vazar com o status original: um 401 da Stripe faria o front achar que a
 * sessão do usuário expirou. Vira 502 com um código estável.
 */
@Catch(Stripe.errors.StripeError)
export class StripeErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('Stripe');

  catch(exception: InstanceType<typeof Stripe.errors.StripeError>, host: ArgumentsHost) {
    this.logger.error(`${exception.type} ${exception.code ?? ''} ${exception.message}`);
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(502)
      .json({ statusCode: 502, message: 'stripe_error', stripeCode: exception.code ?? exception.type });
  }
}
