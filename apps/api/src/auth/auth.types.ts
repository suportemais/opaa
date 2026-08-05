export type AuthUser = {
  userId: string;
  tenantId: string;
  name: string;
  email: string;
  permissionCodes: string[];
  unitIds: string[];
};
