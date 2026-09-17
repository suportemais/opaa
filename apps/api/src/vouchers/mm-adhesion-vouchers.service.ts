import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MmAdhesionVoucherStatus, Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { normalizeBrDocument } from '../common/br-document';
import { PrismaService } from '../prisma/prisma.service';
import {
  generateAdhesionVoucherCode,
  isPrismaUniqueViolation,
  MM_ADHESION_VOUCHER_MINT_ATTEMPTS,
  normalizeAdhesionVoucher,
} from '../domain/vouchers/code';
import { parsePositiveInt } from '../domain/vouchers/rate-limit';

export type AdhesionVoucherFailureReason =
  'not_found' | 'expired' | 'used' | 'cancelled' | 'invalid_format';

export type AdhesionVoucherIssuer = {
  cnpj: string;
  legalName: string;
  tradeName: string;
};

export type AdhesionVoucherView = {
  id: string;
  voucher: string;
  status: 'unused' | 'used' | 'cancelled' | 'expired';
  issuer: AdhesionVoucherIssuer;
  amountCents: number | null;
  rules: Record<string, unknown> | null;
  expiresAt: string;
  usedAt: string | null;
  usedByMmUserId: string | null;
  usedByMmCompanyId: string | null;
  createdAt: string;
};

export type ResolveAdhesionVoucherResult =
  | {
      ok: true;
      voucher: string;
      cnpj: string;
      legalName: string;
      tradeName: string;
      issuer: AdhesionVoucherIssuer;
      amountCents: number | null;
      rules: Record<string, unknown> | null;
      expiresAt: string;
      status: 'unused';
    }
  | {
      ok: false;
      reason: AdhesionVoucherFailureReason;
      voucher?: string;
      usedAt?: string;
    };

export type ConsumeAdhesionVoucherResult =
  | {
      ok: true;
      voucher: string;
      status: 'used';
      usedAt: string;
      cnpj: string;
      legalName: string;
      tradeName: string;
      issuer: AdhesionVoucherIssuer;
      amountCents: number | null;
      rules: Record<string, unknown> | null;
      expiresAt: string;
    }
  | {
      ok: false;
      reason: AdhesionVoucherFailureReason;
      voucher?: string;
      usedAt?: string;
    };

type StoredVoucher = {
  id: string;
  code: string;
  issuerCnpj: string;
  issuerLegalName: string;
  issuerTradeName: string;
  amountCents: number | null;
  rules: Prisma.JsonValue | null;
  expiresAt: Date;
  status: MmAdhesionVoucherStatus;
  usedAt: Date | null;
  usedByMmUserId: string | null;
  usedByMmCompanyId: string | null;
  cancelledAt: Date | null;
  createdAt: Date;
};

const STORED_SELECT = {
  id: true,
  code: true,
  issuerCnpj: true,
  issuerLegalName: true,
  issuerTradeName: true,
  amountCents: true,
  rules: true,
  expiresAt: true,
  status: true,
  usedAt: true,
  usedByMmUserId: true,
  usedByMmCompanyId: true,
  cancelledAt: true,
  createdAt: true,
} as const;

@Injectable()
export class MmAdhesionVouchersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async list(user: AuthUser): Promise<AdhesionVoucherView[]> {
    const rows = await this.prisma.mmAdhesionVoucher.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: STORED_SELECT,
    });
    return rows.map((row) => this.toView(row));
  }

  async mint(
    user: AuthUser,
    input: {
      amountCents?: number;
      validityDays?: number;
      rules?: Record<string, unknown>;
    },
  ): Promise<AdhesionVoucherView> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { document: true, legalName: true, tradeName: true },
    });
    if (!tenant) throw new NotFoundException('tenant_not_found');

    const issuer = normalizeBrDocument(tenant.document);
    if (!issuer || issuer.type !== 'cnpj') {
      throw new BadRequestException('issuer_cnpj_required');
    }

    const defaultDays = Math.min(
      365,
      Math.max(
        1,
        parsePositiveInt(
          this.config.get<string>('MM_VOUCHER_DEFAULT_VALIDITY_DAYS'),
          30,
        ),
      ),
    );
    const validityDays = input.validityDays ?? defaultDays;
    const expiresAt = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);
    const amountCents =
      typeof input.amountCents === 'number' ? input.amountCents : null;
    const rules = input.rules
      ? (input.rules as Prisma.InputJsonValue)
      : undefined;

    for (
      let attempt = 0;
      attempt < MM_ADHESION_VOUCHER_MINT_ATTEMPTS;
      attempt += 1
    ) {
      const code = generateAdhesionVoucherCode();
      try {
        const row = await this.prisma.mmAdhesionVoucher.create({
          data: {
            tenantId: user.tenantId,
            code,
            issuerCnpj: issuer.value,
            issuerLegalName: tenant.legalName,
            issuerTradeName: tenant.tradeName,
            amountCents,
            rules,
            expiresAt,
            createdByUserId: user.userId,
          },
          select: STORED_SELECT,
        });
        return this.toView(row);
      } catch (err) {
        if (isPrismaUniqueViolation(err)) continue;
        throw err;
      }
    }

    throw new ServiceUnavailableException('voucher_mint_exhausted');
  }

  async cancel(user: AuthUser, id: string): Promise<AdhesionVoucherView> {
    const row = await this.prisma.mmAdhesionVoucher.findFirst({
      where: { id, tenantId: user.tenantId },
      select: STORED_SELECT,
    });
    if (!row) throw new NotFoundException('voucher_not_found');

    const blocked = this.failureReason(row);
    if (blocked === 'used')
      throw new BadRequestException('voucher_already_used');
    if (blocked === 'expired') throw new BadRequestException('voucher_expired');
    if (blocked === 'cancelled') return this.toView(row);

    const cancelledAt = new Date();
    const updated = await this.prisma.mmAdhesionVoucher.update({
      where: { id: row.id },
      data: { status: 'cancelled', cancelledAt },
      select: STORED_SELECT,
    });
    return this.toView(updated);
  }

  async resolve(input: {
    voucher: string;
  }): Promise<ResolveAdhesionVoucherResult> {
    const loaded = await this.loadByCode(input.voucher);
    if (!loaded.row) {
      return { ok: false, reason: loaded.reason };
    }
    const reason = this.failureReason(loaded.row);
    if (reason) {
      return this.failure(loaded.row, reason);
    }
    return {
      ok: true,
      voucher: loaded.row.code,
      cnpj: loaded.row.issuerCnpj,
      legalName: loaded.row.issuerLegalName,
      tradeName: loaded.row.issuerTradeName,
      issuer: this.issuer(loaded.row),
      amountCents: loaded.row.amountCents,
      rules: asRules(loaded.row.rules),
      expiresAt: loaded.row.expiresAt.toISOString(),
      status: 'unused',
    };
  }

  async consume(input: {
    voucher: string;
    mmUserId?: string;
    mmCompanyId?: string;
  }): Promise<ConsumeAdhesionVoucherResult> {
    const loaded = await this.loadByCode(input.voucher);
    if (!loaded.row) {
      return { ok: false, reason: loaded.reason };
    }
    const reason = this.failureReason(loaded.row);
    if (reason) {
      return this.failure(loaded.row, reason);
    }

    const usedAt = new Date();
    const claimed = await this.prisma.mmAdhesionVoucher.updateMany({
      where: {
        id: loaded.row.id,
        status: 'unused',
        usedAt: null,
        cancelledAt: null,
        expiresAt: { gt: usedAt },
      },
      data: {
        status: 'used',
        usedAt,
        usedByMmUserId: input.mmUserId?.trim() || null,
        usedByMmCompanyId: input.mmCompanyId?.trim() || null,
      },
    });

    if (claimed.count !== 1) {
      const again = await this.prisma.mmAdhesionVoucher.findUnique({
        where: { id: loaded.row.id },
        select: STORED_SELECT,
      });
      if (!again) return { ok: false, reason: 'not_found' };
      const next = this.failureReason(again) ?? 'used';
      return this.failure(again, next);
    }

    return {
      ok: true,
      voucher: loaded.row.code,
      status: 'used',
      usedAt: usedAt.toISOString(),
      cnpj: loaded.row.issuerCnpj,
      legalName: loaded.row.issuerLegalName,
      tradeName: loaded.row.issuerTradeName,
      issuer: this.issuer(loaded.row),
      amountCents: loaded.row.amountCents,
      rules: asRules(loaded.row.rules),
      expiresAt: loaded.row.expiresAt.toISOString(),
    };
  }

  private async loadByCode(
    raw: string,
  ): Promise<
    | { row: StoredVoucher; reason?: never }
    | { row: null; reason: AdhesionVoucherFailureReason }
  > {
    const code = normalizeAdhesionVoucher(raw);
    if (!code) return { row: null, reason: 'invalid_format' };
    const row = await this.prisma.mmAdhesionVoucher.findUnique({
      where: { code },
      select: STORED_SELECT,
    });
    if (!row) return { row: null, reason: 'not_found' };
    return { row };
  }

  private failureReason(
    row: StoredVoucher,
  ): Exclude<
    AdhesionVoucherFailureReason,
    'not_found' | 'invalid_format'
  > | null {
    if (row.cancelledAt || row.status === 'cancelled') return 'cancelled';
    if (row.usedAt || row.status === 'used') return 'used';
    if (row.expiresAt.getTime() <= Date.now()) return 'expired';
    return null;
  }

  private failure(
    row: StoredVoucher,
    reason: AdhesionVoucherFailureReason,
  ): {
    ok: false;
    reason: AdhesionVoucherFailureReason;
    voucher: string;
    usedAt?: string;
  } {
    return {
      ok: false,
      reason,
      voucher: row.code,
      ...(row.usedAt ? { usedAt: row.usedAt.toISOString() } : {}),
    };
  }

  private issuer(row: StoredVoucher): AdhesionVoucherIssuer {
    return {
      cnpj: row.issuerCnpj,
      legalName: row.issuerLegalName,
      tradeName: row.issuerTradeName,
    };
  }

  private toView(row: StoredVoucher): AdhesionVoucherView {
    const reason = this.failureReason(row);
    const status =
      reason === 'expired'
        ? 'expired'
        : reason === 'used'
          ? 'used'
          : reason === 'cancelled'
            ? 'cancelled'
            : 'unused';
    return {
      id: row.id,
      voucher: row.code,
      status,
      issuer: this.issuer(row),
      amountCents: row.amountCents,
      rules: asRules(row.rules),
      expiresAt: row.expiresAt.toISOString(),
      usedAt: row.usedAt ? row.usedAt.toISOString() : null,
      usedByMmUserId: row.usedByMmUserId,
      usedByMmCompanyId: row.usedByMmCompanyId,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

function asRules(
  value: Prisma.JsonValue | null,
): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}
