import { normalizeCnpj } from '../../common/br-document';

export type RewardIssuer = {
  cnpj: string;
  legalName: string;
  tradeName: string;
};

export type UnitIssuerSource = {
  id: string;
  name: string;
  document: string | null;
  legalName?: string | null;
};

export type RewardUnitSnapshot = {
  unitId: string;
  issuerCnpj: string;
  issuerLegalName: string;
  issuerTradeName: string;
};

/** Snapshot the unit CNPJ/name. Returns null for missing/invalid/CPF documents. */
export function snapshotUnitIssuer(
  unit: UnitIssuerSource,
): RewardUnitSnapshot | null {
  const issuerCnpj = normalizeCnpj(unit.document);
  if (!issuerCnpj) return null;
  return {
    unitId: unit.id,
    issuerCnpj,
    issuerLegalName: unit.legalName?.trim() || unit.name,
    issuerTradeName: unit.name,
  };
}

export function rewardIssuerView(row: {
  issuerCnpj: string | null;
  issuerLegalName: string | null;
  issuerTradeName: string | null;
}): RewardIssuer | null {
  if (!row.issuerCnpj) return null;
  return {
    cnpj: row.issuerCnpj,
    legalName: row.issuerLegalName || '',
    tradeName: row.issuerTradeName || '',
  };
}

/** Additive verify/redeem/list shape, aligned with adhesion resolve. */
export function rewardUnitContract(row: {
  unitId: string | null;
  issuerCnpj: string | null;
  issuerLegalName: string | null;
  issuerTradeName: string | null;
}): {
  cnpj: string | null;
  legalName: string | null;
  tradeName: string | null;
  unitId: string | null;
  unitName: string | null;
  issuer: RewardIssuer | null;
} {
  return {
    cnpj: row.issuerCnpj,
    legalName: row.issuerLegalName,
    tradeName: row.issuerTradeName,
    unitId: row.unitId,
    unitName: row.unitId ? row.issuerTradeName : null,
    issuer: rewardIssuerView(row),
  };
}
