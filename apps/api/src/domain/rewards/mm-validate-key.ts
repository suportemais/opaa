export type MmValidateKeyResult = {
  mmCompanyId: string;
  tradeName: string | null;
};

const MM_VALIDATE_KEY_PATH = '/internal/opiina/validate-key';

export function mmValidateKeyPath(): string {
  return MM_VALIDATE_KEY_PATH;
}

export function mmApiKeyLast4(apiKey: string): string {
  return apiKey.trim().slice(-4);
}

export function maskMmApiKey(last4: string | null | undefined): string {
  const tail = last4?.trim();
  return tail ? `••••${tail}` : '••••';
}

export function mmValidateKeyUrl(apiBaseUrl: string): string {
  const base = apiBaseUrl.trim().replace(/\/+$/, '');
  return `${base}${MM_VALIDATE_KEY_PATH}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function stringField(
  row: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const raw = row[key];
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
  }
  return null;
}

export function isMmValidateKeyRejected(
  status: number,
  body: unknown,
): boolean {
  if (status === 401 || status === 403 || status === 404) return true;
  const obj = asRecord(body);
  if (!obj) return false;
  if (obj.ok === false || obj.valid === false || obj.success === false) {
    return true;
  }
  const reason = stringField(obj, ['reason', 'error', 'code']);
  if (!reason) return false;
  return /invalid|unauthorized|not_found|revoked|forbidden/.test(
    reason.toLowerCase(),
  );
}

/**
 * Accepts the documented `{ ok, mmCompanyId, tradeName }` body and nested
 * `{ company: { id, tradeName } }` in case MM ships a slightly different shape.
 */
export function parseMmValidateKeyResponse(
  body: unknown,
): MmValidateKeyResult | null {
  const root = asRecord(body);
  if (!root) return null;
  if (root.ok === false || root.valid === false || root.success === false) {
    return null;
  }

  const nested =
    asRecord(root.company) ?? asRecord(root.data) ?? asRecord(root.result);
  const row = nested ?? root;

  const mmCompanyId =
    stringField(row, ['mmCompanyId', 'companyId', 'id']) ??
    stringField(root, ['mmCompanyId', 'companyId']);
  if (!mmCompanyId) return null;

  const tradeName =
    stringField(row, ['tradeName', 'nomeFantasia', 'fantasyName']) ??
    stringField(root, ['tradeName', 'nomeFantasia', 'fantasyName']);

  return { mmCompanyId, tradeName };
}
