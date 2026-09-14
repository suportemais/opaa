import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WebhookOutboxService } from '../webhook-outbox/webhook-outbox.service';
import {
  generateRewardCode,
  buildRewardDeepLink,
} from '../domain/rewards/code';
import {
  resolveCustomerKey,
  type CustomerKeyInput,
} from '../domain/rewards/customer-key';
import {
  signRewardPayload,
  type RewardSignedPayload,
} from '../domain/rewards/hmac';
import { renderRewardWhatsappMessage } from '../domain/rewards/whatsapp-message';

export const REWARD_WHATSAPP_EVENT_TYPE = 'reward.whatsapp.send';

export type EmitForCompletedResponseInput = {
  tenantId: string;
  surveyId: string;
  surveyResponseId: string;
  customerId?: string | null;
  identity: CustomerKeyInput;
};

export type RewardEmitResult =
  | { status: 'issued'; couponId: string; code: string; customerKey: string }
  | {
      status: 'already_issued';
      couponId: string;
      code: string;
      customerKey: string;
    }
  | { status: 'skipped'; reason: string };

type EligibleCampaign = {
  id: string;
  prefix: string | null;
  message: string | null;
  mmCompanyId: string;
  rewardAmountCents: number;
  validityDays: number | null;
  endsAt: Date | null;
  totalLimit: number | null;
};

@Injectable()
export class RewardEmitService {
  private readonly logger = new Logger(RewardEmitService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly webhookOutbox: WebhookOutboxService,
    private readonly config: ConfigService,
  ) {}

  async emitForCompletedResponse(
    input: EmitForCompletedResponseInput,
  ): Promise<RewardEmitResult> {
    const survey = await this.prisma.survey.findFirst({
      where: { id: input.surveyId, tenantId: input.tenantId },
      select: { id: true },
    });
    if (!survey) {
      return { status: 'skipped', reason: 'survey_not_found' };
    }

    const campaign = await this.findEligibleCampaign(
      input.tenantId,
      input.surveyId,
    );
    if (!campaign) {
      return { status: 'skipped', reason: 'no_eligible_campaign' };
    }

    const customerKey = resolveCustomerKey(input.identity);
    if (!customerKey) {
      return { status: 'skipped', reason: 'missing_customer_key' };
    }

    const existing = await this.prisma.coupon.findUnique({
      where: {
        campaignId_customerKey: {
          campaignId: campaign.id,
          customerKey: customerKey.key,
        },
      },
      select: { id: true, code: true },
    });
    if (existing) {
      return {
        status: 'already_issued',
        couponId: existing.id,
        code: existing.code,
        customerKey: customerKey.key,
      };
    }

    if (campaign.totalLimit != null) {
      const issuedCount = await this.prisma.coupon.count({
        where: { campaignId: campaign.id, cancelledAt: null },
      });
      if (issuedCount >= campaign.totalLimit) {
        return { status: 'skipped', reason: 'campaign_total_limit' };
      }
    }

    const expiresAt = this.resolveExpiresAt(campaign);
    const secret = (
      this.config.get<string>('MM_REWARD_HMAC_SECRET') ?? ''
    ).trim();
    const appBaseUrl = (
      this.config.get<string>('MM_APP_BASE_URL') ?? ''
    ).trim();

    let created: {
      id: string;
      code: string;
      amountCents: number | null;
      mmCompanyId: string | null;
      expiresAt: Date | null;
    } | null = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateRewardCode(campaign.prefix);
      try {
        created = await this.prisma.coupon.create({
          data: {
            tenantId: input.tenantId,
            campaignId: campaign.id,
            code,
            status: 'generated',
            customerId: input.customerId ?? null,
            customerKey: customerKey.key,
            amountCents: campaign.rewardAmountCents,
            mmCompanyId: campaign.mmCompanyId,
            surveyResponseId: input.surveyResponseId,
            expiresAt,
          },
          select: {
            id: true,
            code: true,
            amountCents: true,
            mmCompanyId: true,
            expiresAt: true,
          },
        });
        break;
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          const raced = await this.prisma.coupon.findUnique({
            where: {
              campaignId_customerKey: {
                campaignId: campaign.id,
                customerKey: customerKey.key,
              },
            },
            select: { id: true, code: true },
          });
          if (raced) {
            return {
              status: 'already_issued',
              couponId: raced.id,
              code: raced.code,
              customerKey: customerKey.key,
            };
          }
          continue;
        }
        throw err;
      }
    }

    if (!created) {
      this.logger.error(
        `Failed to allocate unique reward code for campaign ${campaign.id}`,
      );
      return { status: 'skipped', reason: 'code_generate_failed' };
    }

    const signedPayload: RewardSignedPayload = {
      amountCents: created.amountCents ?? campaign.rewardAmountCents,
      campaignId: campaign.id,
      code: created.code,
      customerKey: customerKey.key,
      expiresAt: created.expiresAt ? created.expiresAt.toISOString() : null,
      mmCompanyId: created.mmCompanyId ?? campaign.mmCompanyId,
    };
    const signature = secret ? signRewardPayload(signedPayload, secret) : null;
    const deepLink = buildRewardDeepLink({ appBaseUrl, code: created.code });
    const text = renderRewardWhatsappMessage(campaign.message, {
      code: created.code,
      link: deepLink,
      amountCents: signedPayload.amountCents,
    });

    if (customerKey.kind === 'phone') {
      await this.webhookOutbox.enqueue({
        tenantId: input.tenantId,
        eventType: REWARD_WHATSAPP_EVENT_TYPE,
        payload: {
          channel: 'whatsapp',
          to: customerKey.value,
          text,
          code: created.code,
          deepLink,
          deepLinkPath: `/app?voucher=${encodeURIComponent(created.code)}`,
          amountCents: signedPayload.amountCents,
          mmCompanyId: signedPayload.mmCompanyId,
          campaignId: campaign.id,
          customerKey: customerKey.key,
          expiresAt: signedPayload.expiresAt,
          surveyResponseId: input.surveyResponseId,
          couponId: created.id,
          signature,
          signedPayload,
        },
      });

      await this.prisma.coupon.update({
        where: { id: created.id },
        data: { status: 'sent', sentAt: new Date() },
      });
    } else {
      this.logger.log(
        `Issued reward ${created.code} for CPF customerKey; WhatsApp skipped (no phone)`,
      );
    }

    return {
      status: 'issued',
      couponId: created.id,
      code: created.code,
      customerKey: customerKey.key,
    };
  }

  private async findEligibleCampaign(
    tenantId: string,
    surveyId: string,
  ): Promise<EligibleCampaign | null> {
    const now = new Date();
    const row = await this.prisma.couponCampaign.findFirst({
      where: {
        tenantId,
        surveyId,
        status: 'active',
        rewardEnabled: true,
        mmCompanyId: { not: null },
        rewardAmountCents: { gt: 0 },
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        prefix: true,
        message: true,
        mmCompanyId: true,
        rewardAmountCents: true,
        validityDays: true,
        endsAt: true,
        totalLimit: true,
      },
    });

    if (!row?.mmCompanyId || row.mmCompanyId.trim().length === 0) return null;
    if (typeof row.rewardAmountCents !== 'number' || row.rewardAmountCents <= 0)
      return null;

    return {
      id: row.id,
      prefix: row.prefix,
      message: row.message,
      mmCompanyId: row.mmCompanyId.trim(),
      rewardAmountCents: row.rewardAmountCents,
      validityDays: row.validityDays,
      endsAt: row.endsAt,
      totalLimit: row.totalLimit,
    };
  }

  private resolveExpiresAt(campaign: EligibleCampaign): Date | null {
    if (
      typeof campaign.validityDays === 'number' &&
      campaign.validityDays > 0
    ) {
      return new Date(Date.now() + campaign.validityDays * 24 * 60 * 60 * 1000);
    }
    return campaign.endsAt;
  }
}
