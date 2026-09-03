import { PermissionCodes } from './permission-codes';
import {
  ensurePlatformAdminRole,
  isPlatformOperator,
  PLATFORM_ADMIN_ROLE_CODE,
} from './platform-admin';

describe('platform-admin RBAC', () => {
  it('creates platform_admin additively and never deletes roles', async () => {
    const rolePermissionUpsert = jest.fn().mockResolvedValue({});
    const roleDeleteMany = jest.fn();
    const prisma = {
      permission: {
        upsert: jest.fn().mockResolvedValue({
          id: 'p1',
          code: PermissionCodes.PlatformTenantManage,
        }),
        findMany: jest.fn().mockResolvedValue([
          { id: 'p-read', code: PermissionCodes.PlatformTenantRead },
          { id: 'p-manage', code: PermissionCodes.PlatformTenantManage },
        ]),
        deleteMany: jest.fn(),
      },
      role: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'role-1' }),
        update: jest.fn(),
        deleteMany: roleDeleteMany,
        delete: jest.fn(),
      },
      rolePermission: {
        upsert: rolePermissionUpsert,
        deleteMany: jest.fn(),
      },
    };

    const role = await ensurePlatformAdminRole(prisma);
    expect(role.id).toBe('role-1');
    expect(prisma.role.create).toHaveBeenCalledWith({
      data: {
        tenantId: null,
        code: PLATFORM_ADMIN_ROLE_CODE,
        name: 'Administrador da plataforma',
      },
    });
    expect(rolePermissionUpsert).toHaveBeenCalledTimes(2);
    expect(roleDeleteMany).not.toHaveBeenCalled();
    expect(prisma.role.delete).not.toHaveBeenCalled();
    expect(prisma.rolePermission.deleteMany).not.toHaveBeenCalled();
  });

  it('recognizes platform operators by role or existing platform permissions', () => {
    expect(isPlatformOperator({ roleCodes: [PLATFORM_ADMIN_ROLE_CODE] })).toBe(
      true,
    );
    expect(
      isPlatformOperator({
        permissionCodes: [PermissionCodes.PlatformTenantManage],
      }),
    ).toBe(true);
    expect(
      isPlatformOperator({ permissionCodes: [PermissionCodes.UnitManage] }),
    ).toBe(false);
  });
});
