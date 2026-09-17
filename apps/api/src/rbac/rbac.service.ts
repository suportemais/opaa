import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AllPermissionCodes, PermissionCodes } from './permission-codes';
import { ensurePlatformAdminRole } from './platform-admin';

/** Default tenant roles. Denúncias (whistleblower) stay exclusive to tenant_admin. */
export const TENANT_DEFAULT_ROLES = [
  {
    code: 'tenant_admin',
    name: 'Administrador do tenant',
    permissions: [
      PermissionCodes.TenantSettingsManage,
      PermissionCodes.UnitRead,
      PermissionCodes.UnitManage,
      PermissionCodes.UserManage,
      PermissionCodes.SurveyRead,
      PermissionCodes.SurveyManage,
      PermissionCodes.ResponseRead,
      PermissionCodes.FeedbackManage,
      PermissionCodes.CustomerRead,
      PermissionCodes.CustomerManage,
      PermissionCodes.EmployeeRead,
      PermissionCodes.EmployeeManage,
      PermissionCodes.WhistleblowerRead,
      PermissionCodes.WhistleblowerManage,
      PermissionCodes.ReviewRead,
      PermissionCodes.ReviewManage,
    ],
  },
  {
    code: 'regional_manager',
    name: 'Gestor regional',
    permissions: [
      PermissionCodes.UnitRead,
      PermissionCodes.SurveyRead,
      PermissionCodes.ResponseRead,
      PermissionCodes.FeedbackManage,
      PermissionCodes.CustomerRead,
      PermissionCodes.EmployeeRead,
      PermissionCodes.ReviewRead,
      PermissionCodes.ReviewManage,
    ],
  },
  {
    code: 'unit_manager',
    name: 'Gestor de unidade',
    permissions: [
      PermissionCodes.UnitRead,
      PermissionCodes.SurveyRead,
      PermissionCodes.ResponseRead,
      PermissionCodes.FeedbackManage,
      PermissionCodes.CustomerRead,
      PermissionCodes.EmployeeRead,
      PermissionCodes.EmployeeManage,
      PermissionCodes.ReviewRead,
      PermissionCodes.ReviewManage,
    ],
  },
  {
    code: 'analyst',
    name: 'Analista',
    permissions: [
      PermissionCodes.UnitRead,
      PermissionCodes.SurveyRead,
      PermissionCodes.ResponseRead,
      PermissionCodes.CustomerRead,
      PermissionCodes.ReviewRead,
    ],
  },
  {
    code: 'collaborator',
    name: 'Colaborador',
    permissions: [],
  },
] as const;

@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  getUserPermissionCodes(user: {
    roles: Array<{
      role: { permissions: Array<{ permission: { code: string } }> };
    }>;
  }) {
    const codes = new Set<string>();
    for (const userRole of user.roles) {
      for (const rp of userRole.role.permissions) {
        codes.add(rp.permission.code);
      }
    }
    return Array.from(codes);
  }

  async ensureGlobalPermissions() {
    for (const code of AllPermissionCodes) {
      await this.prisma.permission.upsert({
        where: { code },
        create: { code, name: code },
        update: {},
      });
    }
  }

  async ensurePlatformAdminRole() {
    await this.ensureGlobalPermissions();
    return ensurePlatformAdminRole(this.prisma);
  }

  async ensureTenantDefaultRoles(tenantId: string) {
    await this.ensureGlobalPermissions();

    for (const roleDef of TENANT_DEFAULT_ROLES) {
      const role = await this.prisma.role.upsert({
        where: { tenantId_code: { tenantId, code: roleDef.code } },
        create: { tenantId, code: roleDef.code, name: roleDef.name },
        update: { name: roleDef.name },
      });

      await this.prisma.rolePermission.deleteMany({
        where: { roleId: role.id },
      });

      const permissions = await this.prisma.permission.findMany({
        where: { code: { in: [...roleDef.permissions] } },
        select: { id: true },
      });

      if (permissions.length) {
        await this.prisma.rolePermission.createMany({
          data: permissions.map((p) => ({
            roleId: role.id,
            permissionId: p.id,
          })),
        });
      }
    }
  }
}
