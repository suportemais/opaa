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
  verifyVerifyRequestSignature,
  type VerifyRequestBody,
} from '../domain/rewards/hmac';

const TIMESTAMP_HEADERS = ['x-mm-timestamp', 'x-opiina-timestamp'] as const;
const SIGNATURE_HEADERS = ['x-mm-signature', 'x-opiina-signature'] as const;

@Injectable()
export class MmRewardHmacGuard implements CanActivate {
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
      method?: string;
      headers: Record<string, string | string[] | undefined>;
      body?: { code?: string; mmCompanyId?: string };
      query?: { code?: string; mmCompanyId?: string };
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

    const source = req.method === 'GET' ? req.query : req.body;
    const code = typeof source?.code === 'string' ? source.code.trim() : '';
    if (!code) {
      throw new UnauthorizedException('mm_reward_code_required');
    }

    const body: VerifyRequestBody = { code };
    const mmCompanyId =
      typeof source?.mmCompanyId === 'string' && source.mmCompanyId.trim()
        ? source.mmCompanyId.trim()
        : undefined;
    if (mmCompanyId) body.mmCompanyId = mmCompanyId;

    const ok = verifyVerifyRequestSignature({
      timestamp,
      body,
      signature,
      secret,
      rawBody: rawRequestBody(req.rawBody),
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
