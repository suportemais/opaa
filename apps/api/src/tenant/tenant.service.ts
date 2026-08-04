import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth.types';
import { badScoreThresholdFromSettings, withBadScoreThreshold } from '../common/tenant-settings';
import type { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  async me(user: AuthUser) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: user.tenantId },
      select: {
        id: true,
        slug: true,
        legalName: true,
        tradeName: true,
        document: true,
        email: true,
        phone: true,
        segment: true,
        primaryColor: true,
        secondaryColor: true,
        status: true,
        settings: true,
        createdAt: true,
      },
    });

    return {
      ...tenant,
      settings: {
        badScoreThreshold: badScoreThresholdFromSettings(tenant.settings),
      },
    };
  }

  async update(user: AuthUser, dto: UpdateTenantDto) {
    const current = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: user.tenantId },
      select: { settings: true },
    });

    const nextSettings =
      typeof dto.badScoreThreshold === 'number' ? withBadScoreThreshold(current.settings, dto.badScoreThreshold) : current.settings;

    const updated = await this.prisma.tenant.update({
      where: { id: user.tenantId },
      data: {
        legalName: dto.legalName,
        tradeName: dto.tradeName,
        document: dto.document,
        email: dto.email,
        phone: dto.phone,
        segment: dto.segment,
        primaryColor: dto.primaryColor,
        secondaryColor: dto.secondaryColor,
        settings: nextSettings as any,
      },
      select: {
        id: true,
        slug: true,
        legalName: true,
        tradeName: true,
        document: true,
        email: true,
        phone: true,
        segment: true,
        primaryColor: true,
        secondaryColor: true,
        status: true,
        settings: true,
        createdAt: true,
      },
    });

    return {
      ...updated,
      settings: {
        badScoreThreshold: badScoreThresholdFromSettings(updated.settings),
      },
    };
  }
}

