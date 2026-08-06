export type AuthUser = {
  userId: string;
  tenantId: string;
  name: string;
  email: string;
  phone: string | null;
  permissionCodes: string[];
  unitIds: string[];
};
