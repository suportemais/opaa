import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  parsePositiveInt,
  SlidingWindowRateLimiter,
} from '../domain/vouchers/rate-limit';
import { normalizeAdhesionVoucher } from '../domain/vouchers/code';

const WINDOW_MS = 60_000;

@Injectable()
export class MmVoucherRateLimitGuard implements CanActivate {
  private readonly limiter = new SlidingWindowRateLimiter();

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      ip?: string;
      headers: Record<string, string | string[] | undefined>;
      body?: { voucher?: string };
    }>();

    const perIp = parsePositiveInt(
      this.config.get<string>('MM_VOUCHER_RATE_LIMIT_PER_MINUTE'),
      30,
    );
    const perCode = parsePositiveInt(
      this.config.get<string>('MM_VOUCHER_RATE_LIMIT_PER_CODE_PER_MINUTE'),
      8,
    );

    const ip = clientIp(req);
    const ipDecision = this.limiter.tryConsume(`ip:${ip}`, perIp, WINDOW_MS);
    if (!ipDecision.allowed) {
      throw rateLimited(ipDecision.retryAfterSeconds);
    }

    const voucher = normalizeAdhesionVoucher(req.body?.voucher);
    if (voucher) {
      const codeDecision = this.limiter.tryConsume(
        `voucher:${voucher}`,
        perCode,
        WINDOW_MS,
      );
      if (!codeDecision.allowed) {
        throw rateLimited(codeDecision.retryAfterSeconds);
      }
    }

    return true;
  }
}

function rateLimited(retryAfterSeconds: number) {
  return new HttpException(
    {
      message: 'mm_voucher_rate_limited',
      retryAfterSeconds,
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}

function clientIp(req: {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}): string {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (typeof raw === 'string' && raw.trim()) {
    return raw.split(',')[0]?.trim() || 'unknown';
  }
  return req.ip?.trim() || 'unknown';
}
