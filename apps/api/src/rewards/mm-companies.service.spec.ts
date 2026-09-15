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
      prismaWithLink({
        mmCompanyId: 'mm-company-gepos',
        tradeName: 'Grupo Geppos',
      }) as never,
    );

    await expect(service.list('tenant-a')).resolves.toEqual([
      { id: 'mm-company-gepos', tradeName: 'Grupo Geppos' },
    ]);
  });

  it('returns an empty picker when the tenant is not linked', async () => {
    const service = new MmCompaniesService(prismaWithLink(null) as never);
    await expect(service.list('tenant-a')).resolves.toEqual([]);
  });
});
