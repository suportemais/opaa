const ACCESS_TOKEN_KEY = 'opaa_at';
const TENANT_ID_KEY = 'opaa_tid';

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string | null) {
  if (!token) localStorage.removeItem(ACCESS_TOKEN_KEY);
  else localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function getTenantId() {
  return localStorage.getItem(TENANT_ID_KEY);
}

export function setTenantId(tenantId: string | null) {
  if (!tenantId) localStorage.removeItem(TENANT_ID_KEY);
  else localStorage.setItem(TENANT_ID_KEY, tenantId);
}

