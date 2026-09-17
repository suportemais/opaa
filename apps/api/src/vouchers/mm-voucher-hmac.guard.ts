import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  isTimestampFresh,
  rawRequestBody,
  verifyTimestampedBodies,
} from '../domain/rewards/hmac';

const TIMESTAMP_HEADERS = ['x-mm-timestamp', 'x-opiina-timestamp'] as const;
const SIGNATURE_HEADERS = ['x-mm-signature', 'x-opiina-signature'] as const;

@Injectable()
export class MmVoucherHmacGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const secret = (
      this.config.get<string>('MM_REWARD_HMAC_SECRET') ?? ''
    ).trim();
    if (!secret) {
      throw new ServiceUnavailableException('mm_reward_hmac_not_configured');
    }

    const maxSkew = Math.max(
      30,
      Number(this.config.get<string>('MM_REWARD_MAX_SKEW_SECONDS') ?? '300') ||
        300,
    );

    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      body?: { voucher?: string };
      rawBody?: Buffer | string;
    }>();

    const timestamp = firstHeader(req.headers, TIMESTAMP_HEADERS);
    const signature = firstHeader(req.headers, SIGNATURE_HEADERS);
    if (!timestamp || !signature) {
      throw new UnauthorizedException('mm_reward_signature_required');
    }
    if (!isTimestampFresh(timestamp, Date.now(), maxSkew)) {
      throw new UnauthorizedException('mm_reward_timestamp_skew');
    }

    const voucher =
      typeof req.body?.voucher === 'string' ? req.body.voucher.trim() : '';
    if (!voucher) {
      throw new UnauthorizedException('mm_voucher_required');
    }

    const raw = rawRequestBody(req.rawBody);
    const compact = JSON.stringify({ voucher });
    // Prefer the exact raw body so extra consume fields cannot ride an unsigned payload.
    const ok = verifyTimestampedBodies({
      timestamp,
      signature,
      secret,
      bodies: raw ? [raw] : [compact],
    });
    if (!ok) {
      throw new UnauthorizedException('mm_reward_signature_invalid');
    }
    return true;
  }
}

function firstHeader(
  headers: Record<string, string | string[] | undefined>,
  names: readonly string[],
): string | null {
  for (const name of names) {
    const value = headerValue(headers, name);
    if (value) return value;
  }
  return null;
}

function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | null {
  const raw = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0]?.trim() || null;
  if (typeof raw === 'string') return raw.trim() || null;
  return null;
}
