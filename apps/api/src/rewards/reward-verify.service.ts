import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { formatRewardAmountDecimal } from '../domain/rewards/code';
import {
  signRewardPayload,
  type RewardSignedPayload,
} from '../domain/rewards/hmac';

export type VerifyRewardInput = {
  code: string;
  mmCompanyId?: string;
};

export type VerifyRewardResult = {
  valid: boolean;
  reason?:
    'not_found' | 'expired' | 'cancelled' | 'redeemed' | 'company_mismatch';
  amount?: string;
  code?: string;
  amountCents?: number;
  mmCompanyId?: string;
  customerKey?: string;
  expiresAt?: string | null;
  campaignId?: string;
  status?: string;
  signature?: string | null;
  signedPayload?: RewardSignedPayload;
};

@Injectable()
export class RewardVerifyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async verify(input: VerifyRewardInput): Promise<VerifyRewardResult> {
    const code = input.code.trim();
    const coupon = await this.prisma.coupon.findFirst({
      where: {
        code,
        ...(input.mmCompanyId?.trim()
          ? { mmCompanyId: input.mmCompanyId.trim() }
          : {}),
      },
      select: {
        id: true,
        code: true,
        status: true,
        amountCents: true,
        mmCompanyId: true,
        customerKey: true,
        expiresAt: true,
        campaignId: true,
        cancelledAt: true,
        redeemedAt: true,
      },
    });

    if (!coupon) {
      return { valid: false, reason: 'not_found' };
    }

    if (
      input.mmCompanyId?.trim() &&
      coupon.mmCompanyId !== input.mmCompanyId.trim()
    ) {
      return { valid: false, reason: 'company_mismatch' };
    }

    if (coupon.cancelledAt || coupon.status === 'cancelled') {
      return {
        valid: false,
        reason: 'cancelled',
        code: coupon.code,
        campaignId: coupon.campaignId,
      };
    }

    if (coupon.redeemedAt || coupon.status === 'redeemed') {
      return {
        valid: false,
        reason: 'redeemed',
        code: coupon.code,
        campaignId: coupon.campaignId,
      };
    }

    if (
      coupon.status === 'expired' ||
      (coupon.expiresAt && coupon.expiresAt.getTime() <= Date.now())
    ) {
      return {
        valid: false,
        reason: 'expired',
        code: coupon.code,
        campaignId: coupon.campaignId,
      };
    }

    if (
      typeof coupon.amountCents !== 'number' ||
      !coupon.mmCompanyId ||
      !coupon.customerKey
    ) {
      return { valid: false, reason: 'not_found' };
    }

    const signedPayload: RewardSignedPayload = {
      amountCents: coupon.amountCents,
      campaignId: coupon.campaignId,
      code: coupon.code,
      customerKey: coupon.customerKey,
      expiresAt: coupon.expiresAt ? coupon.expiresAt.toISOString() : null,
      mmCompanyId: coupon.mmCompanyId,
    };

    const secret = (
      this.config.get<string>('MM_REWARD_HMAC_SECRET') ?? ''
    ).trim();
    const signature = secret ? signRewardPayload(signedPayload, secret) : null;

    return {
      valid: true,
      amount: formatRewardAmountDecimal(coupon.amountCents),
      code: coupon.code,
      amountCents: coupon.amountCents,
      mmCompanyId: coupon.mmCompanyId,
      customerKey: coupon.customerKey,
      expiresAt: signedPayload.expiresAt,
      campaignId: coupon.campaignId,
      status: coupon.status,
      signature,
      signedPayload,
    };
  }
}
