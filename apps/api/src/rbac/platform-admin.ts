import { PermissionCodes } from './permission-codes';

export const PLATFORM_ADMIN_ROLE_CODE = 'platform_admin';
export const PLATFORM_ADMIN_ROLE_NAME = 'Administrador da plataforma';

export const PLATFORM_ADMIN_PERMISSIONS = [
  PermissionCodes.PlatformTenantRead,
  PermissionCodes.PlatformTenantManage,
] as const;

type PrismaLike = {
  permission: {
    upsert: (args: {
      where: { code: string };
      create: { code: string; name: string };
      update: Record<string, never>;
    }) => Promise<{ id: string; code: string }>;
    findMany: (args: {
      where: { code: { in: string[] } };
      select: { id: true; code: true };
    }) => Promise<Array<{ id: string; code: string }>>;
  };
  role: {
    findFirst: (args: {
      where: { tenantId: null; code: string };
    }) => Promise<{ id: string } | null>;
    create: (args: {
      data: { tenantId: null; code: string; name: string };
    }) => Promise<{ id: string }>;
    update: (args: {
      where: { id: string };
      data: { name: string };
    }) => Promise<{ id: string }>;
  };
  rolePermission: {
    upsert: (args: {
      where: { roleId_permissionId: { roleId: string; permissionId: string } };
      create: { roleId: string; permissionId: string };
      update: Record<string, never>;
    }) => Promise<unknown>;
  };
};

/** Additive: creates platform_admin if missing. Never deletes other roles or permissions. */
export async function ensurePlatformAdminRole(prisma: PrismaLike) {
  for (const code of PLATFORM_ADMIN_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code },
      create: { code, name: code },
      update: {},
    });
  }

  let role = await prisma.role.findFirst({
    where: { tenantId: null, code: PLATFORM_ADMIN_ROLE_CODE },
  });

  if (!role) {
    role = await prisma.role.create({
      data: {
        tenantId: null,
        code: PLATFORM_ADMIN_ROLE_CODE,
        name: PLATFORM_ADMIN_ROLE_NAME,
      },
    });
  } else {
    await prisma.role.update({
      where: { id: role.id },
      data: { name: PLATFORM_ADMIN_ROLE_NAME },
    });
  }

  const permissions = await prisma.permission.findMany({
    where: { code: { in: [...PLATFORM_ADMIN_PERMISSIONS] } },
    select: { id: true, code: true },
  });

  for (const permission of permissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId: role.id, permissionId: permission.id },
      },
      create: { roleId: role.id, permissionId: permission.id },
      update: {},
    });
  }

  return role;
}

export function isPlatformOperator(user: {
  permissionCodes?: string[];
  roleCodes?: string[];
}) {
  const permissions = user.permissionCodes ?? [];
  const roles = user.roleCodes ?? [];
  return (
    roles.includes(PLATFORM_ADMIN_ROLE_CODE) ||
    permissions.includes(PermissionCodes.PlatformTenantManage) ||
    permissions.includes(PermissionCodes.PlatformTenantRead)
  );
}
