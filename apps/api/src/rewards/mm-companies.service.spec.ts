import { MmCompaniesService } from './mm-companies.service';

function prismaWithLink(
  link: { mmCompanyId: string; tradeName: string | null } | null,
) {
  return {
    tenantMmIntegration: {
      findUnique: jest.fn().mockResolvedValue(link),
    },
  };
}

describe('MmCompaniesService', () => {
  it('returns the linked company only when the tenant is connected', async () => {
    const service = new MmCompaniesService(
      {
        get: (key: string) => {
          if (key === 'MM_COMPANIES_JSON') {
            return JSON.stringify([
              { id: 'fallback', tradeName: 'Ignore me' },
              { id: 'other', tradeName: 'Outra rede' },
            ]);
          }
          return '';
        },
      } as never,
      prismaWithLink({
        mmCompanyId: 'mm-company-gepos',
        tradeName: 'Grupo Geppos',
      }) as never,
    );

    await expect(service.list('tenant-a')).resolves.toEqual([
      { id: 'mm-company-gepos', tradeName: 'Grupo Geppos' },
    ]);
  });

  it('falls back to MM_COMPANIES_JSON only when not linked', async () => {
    const service = new MmCompaniesService(
      {
        get: (key: string) => {
          if (key === 'MM_COMPANIES_JSON') {
            return JSON.stringify([
              { id: 'mm-company-gepos', tradeName: 'Grupo Geppos' },
              {
                id: 'est-primo',
                name: 'PRIMO JARDINS',
                type: 'establishment',
                companyId: 'mm-company-gepos',
              },
            ]);
          }
          return '';
        },
      } as never,
      prismaWithLink(null) as never,
    );

    await expect(service.list('tenant-a')).resolves.toEqual([
      { id: 'mm-company-gepos', tradeName: 'Grupo Geppos' },
    ]);
  });

  it('returns an empty picker when not linked and no emergency JSON', async () => {
    const service = new MmCompaniesService(
      { get: () => '' } as never,
      prismaWithLink(null) as never,
    );
    await expect(service.list('tenant-a')).resolves.toEqual([]);
  });
});
