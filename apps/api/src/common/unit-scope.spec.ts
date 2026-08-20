import type { AuthUser } from '../auth/auth.types';
import { canAccessUnit, canSeeAllUnits, employeeUnitWhere } from './unit-scope';

function user(partial: Partial<AuthUser> & { permissionCodes: string[]; unitIds: string[] }): AuthUser {
  return {
    userId: 'u1',
    tenantId: 't1',
    name: 'Test',
    email: 't@t.com',
    phone: null,
    ...partial,
  };
}

describe('unit-scope', () => {
  it('lets unit manager access only assigned units even with employee:manage', () => {
    const gestor = user({
      permissionCodes: ['employee:manage', 'employee:read', 'unit:read'],
      unitIds: ['unit-a'],
    });
    expect(canSeeAllUnits(gestor)).toBe(false);
    expect(canAccessUnit(gestor, 'unit-a')).toBe(true);
    expect(canAccessUnit(gestor, 'unit-b')).toBe(false);
    expect(employeeUnitWhere(gestor)).toEqual({ unitId: { in: ['unit-a'] } });
  });

  it('lets regional manager access every unit', () => {
    const regional = user({
      permissionCodes: ['employee:manage', 'employee:read', 'unit:read', 'unit:read:all'],
      unitIds: [],
    });
    expect(canSeeAllUnits(regional)).toBe(true);
    expect(canAccessUnit(regional, 'unit-b')).toBe(true);
    expect(employeeUnitWhere(regional)).toEqual({});
  });
});
