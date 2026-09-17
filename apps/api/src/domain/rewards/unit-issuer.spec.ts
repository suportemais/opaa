import { rewardUnitContract, snapshotUnitIssuer } from './unit-issuer';

const UNIT = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  name: 'Unidade Centro',
  document: '33000167000101',
  legalName: 'Centro Alimentos LTDA',
};

describe('snapshotUnitIssuer', () => {
  it('snapshots digits-only CNPJ and unit names', () => {
    expect(snapshotUnitIssuer(UNIT)).toEqual({
      unitId: UNIT.id,
      issuerCnpj: UNIT.document,
      issuerLegalName: UNIT.legalName,
      issuerTradeName: UNIT.name,
    });
  });

  it('rejects missing CNPJ and CPF (never tenant fallback)', () => {
    expect(snapshotUnitIssuer({ ...UNIT, document: null })).toBeNull();
    expect(
      snapshotUnitIssuer({ ...UNIT, document: '390.533.447-05' }),
    ).toBeNull();
  });
});

describe('rewardUnitContract', () => {
  it('matches adhesion-style cnpj + issuer', () => {
    expect(
      rewardUnitContract({
        unitId: UNIT.id,
        issuerCnpj: UNIT.document,
        issuerLegalName: UNIT.legalName,
        issuerTradeName: UNIT.name,
      }),
    ).toEqual({
      cnpj: UNIT.document,
      legalName: UNIT.legalName,
      tradeName: UNIT.name,
      unitId: UNIT.id,
      unitName: UNIT.name,
      issuer: {
        cnpj: UNIT.document,
        legalName: UNIT.legalName,
        tradeName: UNIT.name,
      },
    });
  });
});
