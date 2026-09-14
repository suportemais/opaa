import {
  mmCompanySelectLabel,
  normalizeMmCompanies,
  parseMmCompaniesJson,
} from './mm-companies';

describe('normalizeMmCompanies', () => {
  it('keeps MM Company.tradeName and Company.id (Grupo Geppos)', () => {
    expect(
      normalizeMmCompanies({
        companies: [
          {
            id: 'mm-company-gepos',
            tradeName: 'Grupo Geppos',
            legalName: 'Geppos Ltda',
          },
        ],
        establishments: [
          {
            id: 'est-primo-jardins',
            name: 'PRIMO JARDINS',
            companyId: 'mm-company-gepos',
          },
        ],
      }),
    ).toEqual([{ id: 'mm-company-gepos', tradeName: 'Grupo Geppos' }]);
  });

  it('drops establishment rows even when mixed into a flat list', () => {
    expect(
      normalizeMmCompanies([
        { id: 'mm-company-gepos', tradeName: 'Grupo Geppos', type: 'company' },
        {
          id: 'est-primo-jardins',
          name: 'PRIMO JARDINS',
          type: 'establishment',
          companyId: 'mm-company-gepos',
        },
        {
          id: 'est-2',
          name: 'PRIMO JARDINS',
          companyId: 'mm-company-gepos',
        },
      ]),
    ).toEqual([{ id: 'mm-company-gepos', tradeName: 'Grupo Geppos' }]);
  });

  it('does not treat establishment name as a company label', () => {
    expect(
      normalizeMmCompanies([
        { id: 'est-primo-jardins', name: 'PRIMO JARDINS' },
        { id: 'unit-1', name: 'Unidade Centro' },
      ]),
    ).toEqual([]);
  });

  it('parses MM_COMPANIES_JSON arrays', () => {
    expect(
      normalizeMmCompanies(
        parseMmCompaniesJson(
          '[{"id":"mm-company-gepos","tradeName":"Grupo Geppos"}]',
        ),
      ),
    ).toEqual([{ id: 'mm-company-gepos', tradeName: 'Grupo Geppos' }]);
    expect(parseMmCompaniesJson('not-json')).toEqual([]);
  });

  it('formats the operator-facing select label', () => {
    expect(mmCompanySelectLabel('Grupo Geppos')).toBe('Grupo Geppos — MM');
    expect(mmCompanySelectLabel('')).toBe('Empresa Muito Mais');
  });
});
