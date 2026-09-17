import { PermissionCodes } from './permission-codes';
import { TENANT_DEFAULT_ROLES } from './rbac.service';

describe('tenant default roles', () => {
  it('grants whistleblower access only to tenant_admin', () => {
    const admin = TENANT_DEFAULT_ROLES.find((role) => role.code === 'tenant_admin');
    expect(admin?.permissions).toEqual(
      expect.arrayContaining([PermissionCodes.WhistleblowerRead, PermissionCodes.WhistleblowerManage]),
    );

    for (const role of TENANT_DEFAULT_ROLES) {
      if (role.code === 'tenant_admin') continue;
      expect(role.permissions).not.toContain(PermissionCodes.WhistleblowerRead);
      expect(role.permissions).not.toContain(PermissionCodes.WhistleblowerManage);
    }
  });
});
