import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  normalizeMmCompanies,
  parseMmCompaniesJson,
  type MmCompanyOption,
} from '../domain/rewards/mm-companies';
import {
  formatHmacSignatureHeader,
  signTimestampedBody,
} from '../domain/rewards/hmac';

const MM_COMPANIES_PATH = '/internal/opiina/companies';

@Injectable()
export class MmCompaniesService {
  private readonly logger = new Logger(MmCompaniesService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Operator picker source: MM companies only (`Company.id` + tradeName).
   * Never OPIINA tenants/units or MM establishments.
   */
  async list(): Promise<MmCompanyOption[]> {
    const fromApi = await this.fetchFromMm();
    if (fromApi.length > 0) return fromApi;
    return normalizeMmCompanies(
      parseMmCompaniesJson(this.config.get<string>('MM_COMPANIES_JSON')),
    );
  }

  private async fetchFromMm(): Promise<MmCompanyOption[]> {
    const base = (this.config.get<string>('MM_API_BASE_URL') ?? '')
      .trim()
      .replace(/\/+$/, '');
    const secret = (
      this.config.get<string>('MM_REWARD_HMAC_SECRET') ?? ''
    ).trim();
    if (!base) return [];

    const url = `${base}${MM_COMPANIES_PATH}`;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Opiina-Timestamp': timestamp,
    };
    if (secret) {
      headers['X-Opiina-Signature'] = formatHmacSignatureHeader(
        signTimestampedBody(secret, timestamp, '{}'),
      );
    }

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        this.logger.warn(`MM companies list failed: HTTP ${res.status}`);
        return [];
      }
      const body: unknown = await res.json();
      return normalizeMmCompanies(body);
    } catch (err) {
      this.logger.warn(
        `MM companies list unavailable: ${err instanceof Error ? err.message : 'error'}`,
      );
      return [];
    }
  }
}
