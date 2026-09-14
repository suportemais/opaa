export type MmCompanyOption = {
  /** Muito Mais `Company.id` — never Establishment.id, Tenant.id, or Unit.id */
  id: string;
  /** MM company trade name (e.g. Grupo Geppos), never an establishment name */
  tradeName: string;
};

const ESTABLISHMENT_TYPES = new Set([
  'establishment',
  'estabelecimento',
  'store',
  'loja',
  'unit',
  'unidade',
  'branch',
  'filial',
]);

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

function typeOf(row: Record<string, unknown>): string | null {
  const raw = stringField(row, ['type', 'kind', 'entity', 'entityType']);
  return raw ? raw.toLowerCase() : null;
}

function isEstablishmentRow(row: Record<string, unknown>): boolean {
  const type = typeOf(row);
  if (type && ESTABLISHMENT_TYPES.has(type)) return true;
  if (type === 'company' || type === 'empresa') return false;
  // MM Establishment belongs to a Company (`companyId`).
  if (stringField(row, ['companyId', 'parentCompanyId'])) return true;
  if (
    stringField(row, ['establishmentId', 'establishmentName']) &&
    !stringField(row, ['tradeName', 'nomeFantasia', 'fantasyName'])
  ) {
    return true;
  }
  return false;
}

function pickTradeName(row: Record<string, unknown>): string | null {
  // Company.tradeName only — never establishment `name` (e.g. PRIMO JARDINS).
  return stringField(row, ['tradeName', 'nomeFantasia', 'fantasyName']);
}

function pickCompanyId(row: Record<string, unknown>): string | null {
  return stringField(row, ['id']) ?? stringField(row, ['companyId']);
}

function extractCompanyRows(input: unknown): Record<string, unknown>[] {
  if (Array.isArray(input)) {
    return input
      .map(asRecord)
      .filter((row): row is Record<string, unknown> => Boolean(row));
  }
  const obj = asRecord(input);
  if (!obj) return [];
  for (const key of ['companies', 'mmCompanies']) {
    if (Array.isArray(obj[key])) {
      return (obj[key] as unknown[])
        .map(asRecord)
        .filter((row): row is Record<string, unknown> => Boolean(row));
    }
  }
  const data = asRecord(obj.data);
  if (data && Array.isArray(data.companies)) {
    return (data.companies as unknown[])
      .map(asRecord)
      .filter((row): row is Record<string, unknown> => Boolean(row));
  }
  return [];
}

/** Keep Company.id + tradeName only. Drop establishments and unlabeled rows. */
export function normalizeMmCompanies(input: unknown): MmCompanyOption[] {
  const out: MmCompanyOption[] = [];
  const seen = new Set<string>();
  for (const row of extractCompanyRows(input)) {
    if (isEstablishmentRow(row)) continue;
    const id = pickCompanyId(row);
    const tradeName = pickTradeName(row);
    if (!id || !tradeName) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, tradeName });
  }
  return out;
}

export function parseMmCompaniesJson(raw: string | undefined | null): unknown {
  const trimmed = raw?.trim();
  if (!trimmed) return [];
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return [];
  }
}

export function mmCompanySelectLabel(tradeName: string): string {
  const name = tradeName.trim();
  return name ? `${name} — MM` : 'Empresa Muito Mais';
}
