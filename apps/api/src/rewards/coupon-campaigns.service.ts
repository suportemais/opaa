import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CouponCampaignStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth.types';
import { formatRewardAmountBrl } from '../domain/rewards/code';
import type { CreateCouponCampaignDto } from './dto/create-coupon-campaign.dto';
import type { UpdateCouponCampaignDto } from './dto/update-coupon-campaign.dto';

const V1_PER_CUSTOMER_LIMIT = 1;

@Injectable()
export class CouponCampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthUser) {
    const rows = await this.prisma.couponCampaign.findMany({
      where: { tenantId: user.tenantId },
      include: { survey: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return this.withKpis(user.tenantId, rows);
  }

  async getById(user: AuthUser, id: string) {
    const row = await this.prisma.couponCampaign.findFirst({
      where: { id, tenantId: user.tenantId },
      include: { survey: { select: { id: true, name: true } } },
    });
    if (!row) throw new NotFoundException('campaign_not_found');
    const [mapped] = await this.withKpis(user.tenantId, [row]);
    return mapped;
  }

  async create(user: AuthUser, dto: CreateCouponCampaignDto) {
    const mmCompanyId = dto.mmCompanyId.trim();
    if (!mmCompanyId) throw new BadRequestException('mm_company_id_required');
    await this.assertSurvey(user.tenantId, dto.surveyId);

    const status: CouponCampaignStatus =
      dto.activate === false ? 'draft' : 'active';
    const benefit = `Muito Mais ${formatRewardAmountBrl(dto.rewardAmountCents)}`;

    const created = await this.prisma.couponCampaign.create({
      data: {
        tenantId: user.tenantId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        benefit,
        prefix: dto.prefix?.trim() || 'MM',
        startsAt: parseOptionalDate(dto.startsAt),
        endsAt: parseOptionalDate(dto.endsAt),
        totalLimit: null,
        perCustomerLimit: V1_PER_CUSTOMER_LIMIT,
        status,
        message: dto.message?.trim() || null,
        surveyId: dto.surveyId,
        mmCompanyId,
        rewardEnabled: true,
        rewardAmountCents: dto.rewardAmountCents,
        validityDays: dto.validityDays ?? null,
      },
      include: { survey: { select: { id: true, name: true } } },
    });

    if (status === 'active') {
      await this.prisma.survey.updateMany({
        where: { id: dto.surveyId, tenantId: user.tenantId },
        data: { enableCoupon: true },
      });
    }

    const [mapped] = await this.withKpis(user.tenantId, [created]);
    return mapped;
  }

  async update(user: AuthUser, id: string, dto: UpdateCouponCampaignDto) {
    const existing = await this.prisma.couponCampaign.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) throw new NotFoundException('campaign_not_found');

    if (dto.surveyId) await this.assertSurvey(user.tenantId, dto.surveyId);
    if (dto.mmCompanyId !== undefined && !dto.mmCompanyId.trim()) {
      throw new BadRequestException('mm_company_id_required');
    }

    const rewardAmountCents =
      dto.rewardAmountCents ?? existing.rewardAmountCents ?? undefined;
    const benefit =
      typeof rewardAmountCents === 'number'
        ? `Muito Mais ${formatRewardAmountBrl(rewardAmountCents)}`
        : existing.benefit;

    const updated = await this.prisma.couponCampaign.update({
      where: { id: existing.id },
      data: {
        name: dto.name?.trim() ?? existing.name,
        description:
          dto.description !== undefined
            ? dto.description.trim() || null
            : existing.description,
        benefit,
        prefix:
          dto.prefix !== undefined
            ? dto.prefix.trim() || 'MM'
            : existing.prefix,
        startsAt:
          dto.startsAt !== undefined
            ? parseOptionalDate(dto.startsAt)
            : existing.startsAt,
        endsAt:
          dto.endsAt !== undefined
            ? parseOptionalDate(dto.endsAt)
            : existing.endsAt,
        perCustomerLimit: V1_PER_CUSTOMER_LIMIT,
        message:
          dto.message !== undefined
            ? dto.message.trim() || null
            : existing.message,
        surveyId: dto.surveyId ?? existing.surveyId,
        mmCompanyId: dto.mmCompanyId?.trim() ?? existing.mmCompanyId,
        rewardEnabled: true,
        rewardAmountCents: rewardAmountCents ?? existing.rewardAmountCents,
        validityDays:
          dto.validityDays !== undefined
            ? dto.validityDays
            : existing.validityDays,
        status: dto.status ?? existing.status,
      },
      include: { survey: { select: { id: true, name: true } } },
    });

    if (updated.status === 'active' && updated.surveyId) {
      await this.prisma.survey.updateMany({
        where: { id: updated.surveyId, tenantId: user.tenantId },
        data: { enableCoupon: true },
      });
    }

    const [mapped] = await this.withKpis(user.tenantId, [updated]);
    return mapped;
  }

  async pause(user: AuthUser, id: string) {
    return this.update(user, id, { status: 'paused' });
  }

  async activate(user: AuthUser, id: string) {
    return this.update(user, id, { status: 'active' });
  }

  private async assertSurvey(tenantId: string, surveyId: string) {
    const survey = await this.prisma.survey.findFirst({
      where: { id: surveyId, tenantId },
      select: { id: true },
    });
    if (!survey) throw new BadRequestException('survey_not_found');
  }

  private async withKpis<
    T extends {
      id: string;
      survey: { id: string; name: string } | null;
    },
  >(tenantId: string, rows: T[]) {
    const ids = rows.map((row) => row.id);
    const issued =
      ids.length === 0
        ? []
        : await this.prisma.coupon.groupBy({
            by: ['campaignId'],
            where: { tenantId, campaignId: { in: ids }, cancelledAt: null },
            _count: { _all: true },
          });
    const redeemed =
      ids.length === 0
        ? []
        : await this.prisma.coupon.groupBy({
            by: ['campaignId'],
            where: {
              tenantId,
              campaignId: { in: ids },
              OR: [{ status: 'redeemed' }, { redeemedAt: { not: null } }],
            },
            _count: { _all: true },
          });

    const issuedBy = new Map(
      issued.map((row) => [row.campaignId, row._count._all]),
    );
    const redeemedBy = new Map(
      redeemed.map((row) => [row.campaignId, row._count._all]),
    );

    return rows.map((row) => ({
      ...row,
      perCustomerLimit: V1_PER_CUSTOMER_LIMIT,
      surveyName: row.survey?.name ?? null,
      issuedCount: issuedBy.get(row.id) ?? 0,
      redeemedCount: redeemedBy.get(row.id) ?? 0,
    }));
  }
}

function parseOptionalDate(value?: string | null): Date | null {
  if (value == null || value === '') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new BadRequestException('invalid_date');
  return d;
}
