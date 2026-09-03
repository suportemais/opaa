import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth.types';
import {
  badScoreThresholdFromSettings,
  withBadScoreThreshold,
} from '../common/tenant-settings';
import { normalizeBrDocument } from '../common/br-document';
import { shouldShowStripePrompts } from '../billing/billing-access';
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
        billingMode: true,
        planId: true,
        trialEndsAt: true,
        accessValidUntil: true,
        manualAccessReason: true,
        plan: { select: { id: true, name: true, slug: true } },
      },
    });

    return {
      ...tenant,
      settings: {
        badScoreThreshold: badScoreThresholdFromSettings(tenant.settings),
      },
      billing: {
        billingMode: tenant.billingMode,
        status: tenant.status,
        plan: tenant.plan,
        trialEndsAt: tenant.trialEndsAt,
        accessValidUntil: tenant.accessValidUntil,
        manualAccessReason: tenant.manualAccessReason,
        requiresStripeCheckout: shouldShowStripePrompts({
          billingMode: tenant.billingMode,
          status: tenant.status,
        }),
      },
    };
  }

  async update(user: AuthUser, dto: UpdateTenantDto) {
    const current = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: user.tenantId },
      select: { settings: true, legalName: true, tradeName: true },
    });

    const nextSettings =
      typeof dto.badScoreThreshold === 'number'
        ? withBadScoreThreshold(current.settings, dto.badScoreThreshold)
        : current.settings;

    let nextDocument: string | null | undefined = dto.document;
    let nextLegalName: string | undefined = dto.legalName;
    let nextTradeName: string | undefined = dto.tradeName;

    if (dto.document !== undefined) {
      const normalized = normalizeBrDocument(dto.document);
      if (dto.document && !normalized)
        throw new BadRequestException('invalid_document');
      nextDocument = normalized ? normalized.value : null;

      if (normalized?.type === 'cnpj') {
        const res = await fetch(
          `https://brasilapi.com.br/api/cnpj/v1/${normalized.value}`,
        );
        if (!res.ok) throw new BadRequestException('cnpj_lookup_failed');
        const data = await res.json();
        const razao =
          typeof data?.razao_social === 'string' && data.razao_social.trim()
            ? data.razao_social.trim()
            : null;
        const fantasia =
          typeof data?.nome_fantasia === 'string' && data.nome_fantasia.trim()
            ? data.nome_fantasia.trim()
            : null;

        if (
          !nextLegalName &&
          (!current.legalName || !current.legalName.trim()) &&
          razao
        ) {
          nextLegalName = razao;
        }
        if (
          !nextTradeName &&
          (!current.tradeName || !current.tradeName.trim()) &&
          fantasia
        ) {
          nextTradeName = fantasia;
        }
      }
    }

    const updated = await this.prisma.tenant.update({
      where: { id: user.tenantId },
      data: {
        legalName: nextLegalName,
        tradeName: nextTradeName,
        document: nextDocument,
        email: dto.email,
        phone: dto.phone,
        segment: dto.segment,
        primaryColor: dto.primaryColor,
        secondaryColor: dto.secondaryColor,
        settings: nextSettings,
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
        billingMode: true,
        planId: true,
        trialEndsAt: true,
        accessValidUntil: true,
        manualAccessReason: true,
        plan: { select: { id: true, name: true, slug: true } },
      },
    });

    return {
      ...updated,
      settings: {
        badScoreThreshold: badScoreThresholdFromSettings(updated.settings),
      },
      billing: {
        billingMode: updated.billingMode,
        status: updated.status,
        plan: updated.plan,
        trialEndsAt: updated.trialEndsAt,
        accessValidUntil: updated.accessValidUntil,
        manualAccessReason: updated.manualAccessReason,
        requiresStripeCheckout: shouldShowStripePrompts({
          billingMode: updated.billingMode,
          status: updated.status,
        }),
      },
    };
  }
}
