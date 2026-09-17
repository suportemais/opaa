import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PermissionCodes } from '../rbac/permission-codes';
import type { AuthUser } from '../auth/auth.types';
import { MmAdhesionVouchersService } from './mm-adhesion-vouchers.service';

const UNIT_A = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  name: 'Unidade Centro',
  document: '33000167000101',
  legalName: 'Centro Alimentos LTDA',
};

const UNIT_B = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  name: 'Unidade Shopping',
  document: '00000000000191',
  legalName: 'Shopping Alimentos LTDA',
};

const TENANT_MATRIZ_CNPJ = '00360305000104';

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
    unitId: UNIT_A.id,
    code: '1234567',
    issuerCnpj: UNIT_A.document,
    issuerLegalName: UNIT_A.legalName,
    issuerTradeName: UNIT_A.name,
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

function setup(opts?: {
  units?: Array<{
    id: string;
    name: string;
    document: string | null;
    legalName?: string | null;
  }>;
}) {
  const created: Array<Record<string, unknown>> = [];
  const units = opts?.units ?? [UNIT_A];
  const prisma = {
    tenant: {
      findUnique: jest.fn(async () => ({
        document: TENANT_MATRIZ_CNPJ,
        legalName: 'Matriz LTDA',
        tradeName: 'Matriz',
      })),
    },
    unit: {
      findMany: jest.fn(async () => units),
    },
    mmAdhesionVoucher: {
      findMany: jest.fn(async () => [unusedRow()]),
      findUnique: jest.fn(
        async ({ where }: { where: { id?: string; code?: string } }) => {
          if (where.code === '1234567' || where.id === unusedRow().id) {
            return unusedRow();
          }
          return null;
        },
      ),
      findFirst: jest.fn(async ({ where }: { where: { id: string } }) =>
        where.id === unusedRow().id ? unusedRow() : null,
      ),
      create: jest.fn(
        async ({
          data,
        }: {
          data: {
            code: string;
            unitId?: string;
            issuerCnpj: string;
            issuerLegalName: string;
            issuerTradeName: string;
          };
        }) => {
          created.push(data);
          const unit =
            units.find((row) => row.id === data.unitId) ?? units[0] ?? UNIT_A;
          return unusedRow({
            code: data.code,
            unitId: data.unitId ?? null,
            issuerCnpj: data.issuerCnpj,
            issuerLegalName: data.issuerLegalName,
            issuerTradeName: data.issuerTradeName,
            amountCents: 1500,
            name: unit.name,
          });
        },
      ),
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
  it('refuses to mint when the unit has no CNPJ', async () => {
    const { service, prisma } = setup({
      units: [{ ...UNIT_A, document: null }],
    });
    await expect(service.mint(user(), { unitId: UNIT_A.id })).rejects.toEqual(
      expect.objectContaining({
        constructor: BadRequestException,
        message: expect.stringMatching(/issuer_cnpj_required/),
      }),
    );
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
  });

  it('refuses to mint a CPF stored on the unit', async () => {
    const { service } = setup({
      units: [{ ...UNIT_A, document: '390.533.447-05' }],
    });
    await expect(
      service.mint(user(), { unitId: UNIT_A.id }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires unitId when the tenant has multiple units', async () => {
    const { service, created } = setup({ units: [UNIT_A, UNIT_B] });
    await expect(service.mint(user(), {})).rejects.toEqual(
      expect.objectContaining({
        constructor: BadRequestException,
        message: expect.stringMatching(/unit_required/),
      }),
    );
    expect(created).toHaveLength(0);
  });

  it('auto-selects the only unit and snapshots its CNPJ (never tenant/matriz)', async () => {
    const { service, created, prisma } = setup();
    const row = await service.mint(user(), { amountCents: 1500 });
    expect(row.voucher).toMatch(/^\d{7}$/);
    expect(row.issuer.cnpj).toBe(UNIT_A.document);
    expect(row.issuer.cnpj).not.toBe(TENANT_MATRIZ_CNPJ);
    expect(row.unitId).toBe(UNIT_A.id);
    expect(row.unitName).toBe(UNIT_A.name);
    expect(row.amountCents).toBe(1500);
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      unitId: UNIT_A.id,
      issuerCnpj: UNIT_A.document,
      issuerLegalName: UNIT_A.legalName,
      issuerTradeName: UNIT_A.name,
    });
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
  });

  it('mints unit A vs unit B with different issuer CNPJs', async () => {
    const { service, created } = setup({ units: [UNIT_A, UNIT_B] });
    const a = await service.mint(user(), { unitId: UNIT_A.id });
    const b = await service.mint(user(), { unitId: UNIT_B.id });
    expect(a.issuer.cnpj).toBe(UNIT_A.document);
    expect(b.issuer.cnpj).toBe(UNIT_B.document);
    expect(a.issuer.cnpj).not.toBe(b.issuer.cnpj);
    expect(created.map((row) => row.issuerCnpj)).toEqual([
      UNIT_A.document,
      UNIT_B.document,
    ]);
  });

  it('rejects an unknown unitId', async () => {
    const { service } = setup({ units: [UNIT_A] });
    await expect(
      service.mint(user(), { unitId: UNIT_B.id }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('resolves unused voucher to the unit CNPJ + amount/rules', async () => {
    const { service } = setup();
    await expect(service.resolve({ voucher: '123-4567' })).resolves.toEqual(
      expect.objectContaining({
        ok: true,
        voucher: '1234567',
        cnpj: UNIT_A.document,
        unitId: UNIT_A.id,
        unitName: UNIT_A.name,
        amountCents: 1500,
        rules: { kind: 'wallet_credit' },
        status: 'unused',
        issuer: expect.objectContaining({ cnpj: UNIT_A.document }),
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
      cnpj: UNIT_A.document,
      unitId: UNIT_A.id,
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
