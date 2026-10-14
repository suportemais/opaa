export type AuthUser = {
  userId: string;
  tenantId: string;
  name: string;
  email: string;
  phone: string | null;
  permissionCodes: string[];
  roleCodes: string[];
  /** Nomes legíveis dos papéis (Role.name), na mesma ordem de roleCodes. */
  roleNames?: string[];
  unitIds: string[];
  /** Preenchido só com BILLING_ENFORCEMENT ligado; ver billing-access.ts. */
  billingBlockReason?: string | null;
};
