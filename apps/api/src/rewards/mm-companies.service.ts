import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { MmCompanyOption } from '../domain/rewards/mm-companies';

@Injectable()
export class MmCompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Operator picker: the tenant-linked MM company only.
   * Empty when the tenant has not connected a key.
   */
  async list(tenantId: string): Promise<MmCompanyOption[]> {
    const linked = await this.linkedCompany(tenantId);
    return linked ? [linked] : [];
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
