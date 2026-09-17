import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { formatRewardAmountDecimal } from '../domain/rewards/code';
import {
  rewardUnitContract,
  type RewardIssuer,
} from '../domain/rewards/unit-issuer';

export type RedeemRewardInput = {
  code: string;
  mmCompanyId?: string;
};

export type RedeemRewardResult =
  | {
      ok: true;
      code: string;
      status: 'redeemed';
      redeemedAt: string;
      amount: string;
      amountCents: number;
      mmCompanyId: string;
      customerKey: string;
      campaignId: string;
      cnpj: string | null;
      legalName: string | null;
      tradeName: string | null;
      unitId: string | null;
      unitName: string | null;
      issuer: RewardIssuer | null;
    }
  | {
      ok: false;
      reason:
        'not_found' | 'expired' | 'cancelled' | 'redeemed' | 'company_mismatch';
      code?: string;
      campaignId?: string;
    };

@Injectable()
export class RewardRedeemService {
  constructor(private readonly prisma: PrismaService) {}

  async markRedeemed(input: RedeemRewardInput): Promise<RedeemRewardResult> {
    const code = input.code.trim();
    const scopedCompany = input.mmCompanyId?.trim() || undefined;

    const coupon = await this.prisma.coupon.findFirst({
      where: {
        code,
        ...(scopedCompany ? { mmCompanyId: scopedCompany } : {}),
      },
      select: {
        id: true,
        tenantId: true,
        campaignId: true,
        code: true,
        status: true,
        amountCents: true,
        mmCompanyId: true,
        customerKey: true,
        customerId: true,
        cancelledAt: true,
        redeemedAt: true,
        expiresAt: true,
        unitId: true,
        issuerCnpj: true,
        issuerLegalName: true,
        issuerTradeName: true,
      },
    });

    if (!coupon) {
      return { ok: false, reason: 'not_found' };
    }

    if (scopedCompany && coupon.mmCompanyId !== scopedCompany) {
      return { ok: false, reason: 'company_mismatch', code: coupon.code };
    }

    if (coupon.cancelledAt || coupon.status === 'cancelled') {
      return {
        ok: false,
        reason: 'cancelled',
        code: coupon.code,
        campaignId: coupon.campaignId,
      };
    }

    if (coupon.redeemedAt || coupon.status === 'redeemed') {
      return {
        ok: false,
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
        ok: false,
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
      return { ok: false, reason: 'not_found' };
    }

    const redeemedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.coupon.update({
        where: { id: coupon.id },
        data: { status: 'redeemed', redeemedAt },
      });
      await tx.couponRedemption.create({
        data: {
          tenantId: coupon.tenantId,
          couponId: coupon.id,
          customerId: coupon.customerId,
          unitId: coupon.unitId,
          redeemedAt,
          metadata: {
            source: 'mm',
            ...(scopedCompany ? { mmCompanyId: scopedCompany } : {}),
            ...(coupon.issuerCnpj ? { cnpj: coupon.issuerCnpj } : {}),
          },
        },
      });
    });

    return {
      ok: true,
      code: coupon.code,
      status: 'redeemed',
      redeemedAt: redeemedAt.toISOString(),
      amount: formatRewardAmountDecimal(coupon.amountCents),
      amountCents: coupon.amountCents,
      mmCompanyId: coupon.mmCompanyId,
      customerKey: coupon.customerKey,
      campaignId: coupon.campaignId,
      ...rewardUnitContract(coupon),
    };
  }
}
