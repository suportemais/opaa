import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth.types';
import { encryptSecret } from '../common/crypto';
import {
  formatHmacSignatureHeader,
  signTimestampedBody,
} from '../domain/rewards/hmac';
import {
  isMmValidateKeyRejected,
  mmApiKeyLast4,
  mmValidateKeyUrl,
  parseMmValidateKeyResponse,
} from '../domain/rewards/mm-validate-key';

export type MmIntegrationStatus = {
  connected: boolean;
  mmCompanyId: string | null;
  tradeName: string | null;
  connectedAt: string | null;
  apiKeyLast4: string | null;
};

const DISCONNECTED: MmIntegrationStatus = {
  connected: false,
  mmCompanyId: null,
  tradeName: null,
  connectedAt: null,
  apiKeyLast4: null,
};

@Injectable()
export class MmIntegrationsService {
  private readonly logger = new Logger(MmIntegrationsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async status(user: AuthUser): Promise<MmIntegrationStatus> {
    const row = await this.prisma.tenantMmIntegration.findUnique({
      where: { tenantId: user.tenantId },
      select: {
        mmCompanyId: true,
        tradeName: true,
        connectedAt: true,
        apiKeyLast4: true,
      },
    });
    return this.toStatus(row);
  }

  async connect(
    user: AuthUser,
    apiKeyRaw: string,
  ): Promise<MmIntegrationStatus> {
    const apiKey = apiKeyRaw.trim();
    if (!apiKey) throw new BadRequestException('api_key_required');

    const base = (this.config.get<string>('MM_API_BASE_URL') ?? '').trim();
    if (!base) throw new ServiceUnavailableException('mm_api_not_configured');

    const integrationsSecret = this.integrationsSecret();
    if (!integrationsSecret) {
      throw new ServiceUnavailableException(
        'integrations_secret_not_configured',
      );
    }

    const validated = await this.validateKeyWithMm(base, apiKey);
    const apiKeyEncrypted = encryptSecret(apiKey, integrationsSecret);
    const apiKeyLast4 = mmApiKeyLast4(apiKey);
    const connectedAt = new Date();

    const row = await this.prisma.tenantMmIntegration.upsert({
      where: { tenantId: user.tenantId },
      create: {
        tenantId: user.tenantId,
        mmCompanyId: validated.mmCompanyId,
        tradeName: validated.tradeName,
        apiKeyEncrypted,
        apiKeyLast4,
        connectedAt,
      },
      update: {
        mmCompanyId: validated.mmCompanyId,
        tradeName: validated.tradeName,
        apiKeyEncrypted,
        apiKeyLast4,
        connectedAt,
      },
      select: {
        mmCompanyId: true,
        tradeName: true,
        connectedAt: true,
        apiKeyLast4: true,
      },
    });

    this.logger.log(
      `MM integration linked tenant=${user.tenantId} company=${row.mmCompanyId}`,
    );
    return this.toStatus(row);
  }

  async disconnect(user: AuthUser): Promise<MmIntegrationStatus> {
    await this.prisma.tenantMmIntegration.deleteMany({
      where: { tenantId: user.tenantId },
    });
    return DISCONNECTED;
  }

  private toStatus(
    row: {
      mmCompanyId: string;
      tradeName: string | null;
      connectedAt: Date;
      apiKeyLast4: string | null;
    } | null,
  ): MmIntegrationStatus {
    if (!row) return DISCONNECTED;
    return {
      connected: true,
      mmCompanyId: row.mmCompanyId,
      tradeName: row.tradeName,
      connectedAt: row.connectedAt.toISOString(),
      apiKeyLast4: row.apiKeyLast4,
    };
  }

  private integrationsSecret(): string {
    return (
      (this.config.get<string>('INTEGRATIONS_SECRET') ?? '').trim() ||
      (this.config.get<string>('JWT_ACCESS_SECRET') ?? '').trim()
    );
  }

  private async validateKeyWithMm(base: string, apiKey: string) {
    const url = mmValidateKeyUrl(base);
    const rawBody = JSON.stringify({ apiKey });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const hmacSecret = (
      this.config.get<string>('MM_REWARD_HMAC_SECRET') ?? ''
    ).trim();

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Opiina-Timestamp': timestamp,
    };
    if (hmacSecret) {
      headers['X-Opiina-Signature'] = formatHmacSignatureHeader(
        signTimestampedBody(hmacSecret, timestamp, rawBody),
      );
    }

    let res: Response;
    let body: unknown = null;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers,
        body: rawBody,
        signal: AbortSignal.timeout(8000),
      });
      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        body = await res.json();
      } else {
        body = await res.text();
      }
    } catch (err) {
      this.logger.warn(
        `MM validate-key unavailable: ${err instanceof Error ? err.message : 'error'}`,
      );
      throw new BadGatewayException('mm_validate_unavailable');
    }

    if (isMmValidateKeyRejected(res.status, body)) {
      throw new BadRequestException('invalid_mm_api_key');
    }
    if (!res.ok) {
      this.logger.warn(`MM validate-key failed: HTTP ${res.status}`);
      throw new BadGatewayException('mm_validate_unavailable');
    }

    const parsed = parseMmValidateKeyResponse(body);
    if (!parsed) {
      throw new BadGatewayException('invalid_mm_validate_response');
    }
    return parsed;
  }
}
