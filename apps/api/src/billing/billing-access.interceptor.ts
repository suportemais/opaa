import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser } from '../auth/auth.types';
import { ALLOW_BILLING_BLOCKED_KEY } from './allow-billing-blocked.decorator';

/**
 * Interceptors rodam depois dos guards, então `req.user` já foi preenchido
 * pelo JwtStrategy (que calcula `billingBlockReason`). Rotas sem usuário
 * (públicas) não são afetadas.
 */
@Injectable()
export class BillingAccessInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const reason = req.user?.billingBlockReason;
    if (!reason) return next.handle();

    const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_BILLING_BLOCKED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowed) return next.handle();

    throw new HttpException(
      { statusCode: HttpStatus.PAYMENT_REQUIRED, message: 'billing_required', reason },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
