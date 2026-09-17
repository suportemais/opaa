import { BadRequestException } from '@nestjs/common';
import { PermissionCodes } from '../rbac/permission-codes';
import type { AuthUser } from '../auth/auth.types';
import { MmAdhesionVouchersService } from './mm-adhesion-vouchers.service';

const CNPJ = '33000167000101';

function user(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    userId: '11111111-1111-4111-8111-111111111111',
    tenantId: '22222222-2222-4222-8222-222222222222',
    name: 'Ana',
    email: 'ana@example.com',
    phone: null,
    permissionCodes: [PermissionCodes.TenantSettingsManage],
    roleCodes: ['tenant_admin'],
    unitIds: [],
    ...overrides,
  };
}

function unusedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    code: '1234567',
    issuerCnpj: CNPJ,
    issuerLegalName: 'Empresa LTDA',
    issuerTradeName: 'Empresa',
    amountCents: 1500,
    rules: { kind: 'wallet_credit' },
    expiresAt: new Date(Date.now() + 86_400_000),
    status: 'unused',
    usedAt: null,
    usedByMmUserId: null,
    usedByMmCompanyId: null,
    cancelledAt: null,
    createdAt: new Date('2026-09-17T12:00:00.000Z'),
    ...overrides,
  };
}

function setup(opts?: { document?: string | null; tenant?: boolean }) {
  const created: unknown[] = [];
  const prisma = {
    tenant: {
      findUnique: jest.fn(async () =>
        opts?.tenant === false
          ? null
          : {
              document: opts?.document === undefined ? CNPJ : opts.document,
              legalName: 'Empresa LTDA',
              tradeName: 'Empresa',
            },
      ),
    },
    mmAdhesionVoucher: {
      findMany: jest.fn(async () => [unusedRow()]),
      findUnique: jest.fn(async ({ where }: { where: { id?: string; code?: string } }) => {
        if (where.code === '1234567' || where.id === unusedRow().id) {
          return unusedRow();
        }
        return null;
      }),
      findFirst: jest.fn(async ({ where }: { where: { id: string } }) =>
        where.id === unusedRow().id ? unusedRow() : null,
      ),
      create: jest.fn(async ({ data }: { data: { code: string } }) => {
        created.push(data);
        return unusedRow({ code: data.code });
      }),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) =>
        unusedRow({ ...data, cancelledAt: data.cancelledAt ?? null }),
      ),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
  };

  const service = new MmAdhesionVouchersService(
    prisma as never,
    {
      get: (key: string) =>
        key === 'MM_VOUCHER_DEFAULT_VALIDITY_DAYS' ? '30' : undefined,
    } as never,
  );

  return { service, prisma, created };
}

describe('MmAdhesionVouchersService', () => {
  it('refuses to mint without a valid issuer CNPJ', async () => {
    const { service } = setup({ document: '390.533.447-05' });
    await expect(service.mint(user(), {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('mints a 7-digit voucher snapshotting issuer CNPJ', async () => {
    const { service, created } = setup();
    const row = await service.mint(user(), { amountCents: 1500 });
    expect(row.voucher).toMatch(/^\d{7}$/);
    expect(row.issuer.cnpj).toBe(CNPJ);
    expect(row.amountCents).toBe(1500);
    expect(created).toHaveLength(1);
  });

  it('resolves unused voucher to CNPJ + amount/rules', async () => {
    const { service } = setup();
    await expect(service.resolve({ voucher: '123-4567' })).resolves.toEqual(
      expect.objectContaining({
        ok: true,
        voucher: '1234567',
        cnpj: CNPJ,
        amountCents: 1500,
        rules: { kind: 'wallet_credit' },
        status: 'unused',
      }),
    );
  });

  it('does not reveal unused codes for unknown or malformed input', async () => {
    const { service } = setup();
    await expect(service.resolve({ voucher: '0000000' })).resolves.toEqual({
      ok: false,
      reason: 'not_found',
    });
    await expect(service.resolve({ voucher: '12' })).resolves.toEqual({
      ok: false,
      reason: 'invalid_format',
    });
  });

  it('marks used exactly once', async () => {
    const { service, prisma } = setup();
    const first = await service.consume({
      voucher: '1234567',
      mmUserId: 'mm-user-1',
      mmCompanyId: 'mm-co-1',
    });
    expect(first).toMatchObject({
      ok: true,
      status: 'used',
      cnpj: CNPJ,
      amountCents: 1500,
    });
    expect(prisma.mmAdhesionVoucher.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'used',
          usedByMmUserId: 'mm-user-1',
          usedByMmCompanyId: 'mm-co-1',
        }),
      }),
    );

    prisma.mmAdhesionVoucher.findUnique.mockResolvedValue(
      unusedRow({
        status: 'used',
        usedAt: new Date('2026-09-17T13:00:00.000Z'),
      }),
    );
    await expect(service.consume({ voucher: '1234567' })).resolves.toEqual(
      expect.objectContaining({ ok: false, reason: 'used' }),
    );
  });

  it('rejects expired vouchers on resolve and consume', async () => {
    const { service, prisma } = setup();
    prisma.mmAdhesionVoucher.findUnique.mockResolvedValue(
      unusedRow({ expiresAt: new Date('2020-01-01T00:00:00.000Z') }),
    );
    await expect(service.resolve({ voucher: '1234567' })).resolves.toEqual(
      expect.objectContaining({ ok: false, reason: 'expired' }),
    );
    await expect(service.consume({ voucher: '1234567' })).resolves.toEqual(
      expect.objectContaining({ ok: false, reason: 'expired' }),
    );
  });
});
