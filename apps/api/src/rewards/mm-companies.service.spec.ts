import { MmCompaniesService } from './mm-companies.service';

describe('MmCompaniesService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns env catalog companies when MM API is unset', async () => {
    const service = new MmCompaniesService({
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
    } as never);

    await expect(service.list()).resolves.toEqual([
      { id: 'mm-company-gepos', tradeName: 'Grupo Geppos' },
    ]);
  });

  it('prefers MM API companies and ignores establishments in the payload', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          companies: [{ id: 'co-1', tradeName: 'Grupo Geppos' }],
          establishments: [
            { id: 'e-1', name: 'PRIMO JARDINS', companyId: 'co-1' },
          ],
        }),
    }) as never;

    const service = new MmCompaniesService({
      get: (key: string) => {
        if (key === 'MM_API_BASE_URL') return 'https://api.muitomais.example';
        if (key === 'MM_REWARD_HMAC_SECRET') return 'secret';
        if (key === 'MM_COMPANIES_JSON') {
          return JSON.stringify([{ id: 'fallback', tradeName: 'Ignore me' }]);
        }
        return '';
      },
    } as never);

    await expect(service.list()).resolves.toEqual([
      { id: 'co-1', tradeName: 'Grupo Geppos' },
    ]);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.muitomais.example/internal/opiina/companies',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});
