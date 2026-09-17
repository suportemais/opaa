import { BadRequestException } from '@nestjs/common';
import { PermissionCodes } from '../rbac/permission-codes';
import type { AuthUser } from '../auth/auth.types';
import { UnitsService } from './units.service';

function user(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    userId: '11111111-1111-4111-8111-111111111111',
    tenantId: '22222222-2222-4222-8222-222222222222',
    name: 'Ana',
    email: 'ana@example.com',
    phone: null,
    permissionCodes: [PermissionCodes.UnitManage],
    roleCodes: ['tenant_admin'],
    unitIds: [],
    ...overrides,
  };
}

describe('UnitsService document', () => {
  function setup() {
    const created: Array<Record<string, unknown>> = [];
    const prisma = {
      unit: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          created.push(data);
          return { id: 'unit-1', settings: null, ...data };
        }),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };
    const service = new UnitsService(prisma as never, {} as never);
    return { service, created, prisma };
  }

  it('stores a unit CNPJ and rejects CPF / invalid docs', async () => {
    const { service, created } = setup();
    await service.create(user(), {
      name: 'Centro',
      document: '33.000.167/0001-01',
      legalName: 'Centro LTDA',
    });
    expect(created[0]).toMatchObject({
      document: '33000167000101',
      legalName: 'Centro LTDA',
    });

    await expect(
      service.create(user(), { name: 'X', document: '390.533.447-05' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.create(user(), { name: 'X', document: '123' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
