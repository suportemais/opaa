export const PermissionCodes = {
  PlatformTenantRead: 'platform:tenant:read',
  PlatformTenantManage: 'platform:tenant:manage',
  TenantSettingsManage: 'tenant:settings:manage',
  UnitRead: 'unit:read',
  UnitReadAll: 'unit:read:all',
  UnitManage: 'unit:manage',
  UserManage: 'user:manage',
  SurveyRead: 'survey:read',
  SurveyManage: 'survey:manage',
  ResponseRead: 'response:read',
  FeedbackManage: 'feedback:manage',
  CustomerRead: 'customer:read',
  CustomerManage: 'customer:manage',
  EmployeeRead: 'employee:read',
  EmployeeManage: 'employee:manage',
  WhistleblowerRead: 'whistleblower:read',
  WhistleblowerManage: 'whistleblower:manage',
  ReviewRead: 'review:read',
  ReviewManage: 'review:manage',
} as const;

export type PermissionCode = (typeof PermissionCodes)[keyof typeof PermissionCodes];

export const AllPermissionCodes: PermissionCode[] = Object.values(PermissionCodes);
