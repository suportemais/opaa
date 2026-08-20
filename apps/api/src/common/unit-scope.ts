import { PermissionCodes } from '../rbac/permission-codes';
import type { AuthUser } from '../auth/auth.types';

export function roleSeesAllUnits(permissionCodes: string[]) {
  return (
    permissionCodes.includes(PermissionCodes.UnitManage) ||
    permissionCodes.includes(PermissionCodes.UnitReadAll)
  );
}

export function canSeeAllUnits(user: AuthUser) {
  return roleSeesAllUnits(user.permissionCodes);
}

export function allowedUnitIds(user: AuthUser) {
  return user.unitIds.length ? user.unitIds : ['__none__'];
}

export function canAccessUnit(user: AuthUser, unitId: string) {
  if (canSeeAllUnits(user)) return true;
  return user.unitIds.includes(unitId);
}

export function employeeUnitWhere(user: AuthUser): { unitId?: { in: string[] } } {
  if (canSeeAllUnits(user)) return {};
  return { unitId: { in: allowedUnitIds(user) } };
}
