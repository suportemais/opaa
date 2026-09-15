import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  normalizeMmCompanies,
  parseMmCompaniesJson,
  type MmCompanyOption,
} from '../domain/rewards/mm-companies';

@Injectable()
export class MmCompaniesService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Operator picker source: the tenant-linked MM company only.
   * `MM_COMPANIES_JSON` is an emergency fallback when no link exists.
   */
  async list(tenantId: string): Promise<MmCompanyOption[]> {
    const linked = await this.linkedCompany(tenantId);
    if (linked) return [linked];
    return normalizeMmCompanies(
      parseMmCompaniesJson(this.config.get<string>('MM_COMPANIES_JSON')),
    );
  }

  private async linkedCompany(
    tenantId: string,
  ): Promise<MmCompanyOption | null> {
    const row = await this.prisma.tenantMmIntegration.findUnique({
      where: { tenantId },
      select: { mmCompanyId: true, tradeName: true },
    });
    if (!row?.mmCompanyId.trim()) return null;
    return {
      id: row.mmCompanyId.trim(),
      tradeName: row.tradeName?.trim() || 'Empresa Muito Mais',
    };
  }
}
