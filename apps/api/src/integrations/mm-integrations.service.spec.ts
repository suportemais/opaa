import {
  BadGatewayException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { decryptSecret, isEncryptedSecret } from '../common/crypto';
import { PermissionCodes } from '../rbac/permission-codes';
import type { AuthUser } from '../auth/auth.types';
import { MmIntegrationsService } from './mm-integrations.service';

function user(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    userId: 'u1',
    tenantId: 'tenant-a',
    name: 'Ana',
    email: 'ana@example.com',
    phone: null,
    permissionCodes: [PermissionCodes.TenantSettingsManage],
    roleCodes: ['tenant_admin'],
    unitIds: [],
    ...overrides,
  };
}

function setup(env: Record<string, string> = {}) {
  const stored: Array<{
    tenantId: string;
    mmCompanyId: string;
    tradeName: string | null;
    apiKeyEncrypted: string;
    connectedAt: Date;
  }> = [];

  const prisma = {
    tenantMmIntegration: {
      findUnique: jest.fn(
        async ({ where }: { where: { tenantId: string } }) => {
          const row = stored.find((item) => item.tenantId === where.tenantId);
          return row
            ? {
                mmCompanyId: row.mmCompanyId,
                tradeName: row.tradeName,
                connectedAt: row.connectedAt,
              }
            : null;
        },
      ),
      upsert: jest.fn(
        async ({
          create,
        }: {
          create: {
            tenantId: string;
            mmCompanyId: string;
            tradeName: string | null;
            apiKeyEncrypted: string;
            connectedAt: Date;
          };
        }) => {
          stored.length = 0;
          stored.push(create);
          return {
            mmCompanyId: create.mmCompanyId,
            tradeName: create.tradeName,
            connectedAt: create.connectedAt,
          };
        },
      ),
      deleteMany: jest.fn(
        async ({ where }: { where: { tenantId: string } }) => {
          const before = stored.length;
          for (let i = stored.length - 1; i >= 0; i -= 1) {
            if (stored[i].tenantId === where.tenantId) stored.splice(i, 1);
          }
          return { count: before - stored.length };
        },
      ),
    },
  };

  const config = {
    get: (key: string) => {
      if (key in env) return env[key];
      if (key === 'MM_API_BASE_URL') return 'https://muitomais.app/api';
      if (key === 'INTEGRATIONS_SECRET') return 'test-integrations-secret';
      if (key === 'MM_REWARD_HMAC_SECRET') return 'hmac-secret';
      return '';
    },
  };

  return {
    service: new MmIntegrationsService(config as never, prisma as never),
    prisma,
    stored,
  };
}

describe('MmIntegrationsService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns disconnected status when no link exists', async () => {
    const { service } = setup();
    await expect(service.status(user())).resolves.toEqual({
      connected: false,
      mmCompanyId: null,
      tradeName: null,
      connectedAt: null,
    });
  });

  it('validates the key, persists encrypted secret, and returns status without the secret', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () =>
        Promise.resolve({
          ok: true,
          mmCompanyId: 'mm-company-gepos',
          tradeName: 'Grupo Geppos',
        }),
    }) as never;

    const { service, prisma, stored } = setup();
    const status = await service.connect(user(), '  mm-live-key-xyz  ');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://muitomais.app/api/internal/opiina/validate-key',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(prisma.tenantMmIntegration.upsert).toHaveBeenCalled();
    expect(stored[0].apiKeyEncrypted).not.toBe('mm-live-key-xyz');
    expect(isEncryptedSecret(stored[0].apiKeyEncrypted)).toBe(true);
    expect(
      decryptSecret(stored[0].apiKeyEncrypted, 'test-integrations-secret'),
    ).toBe('mm-live-key-xyz');
    expect(status).toEqual({
      connected: true,
      mmCompanyId: 'mm-company-gepos',
      tradeName: 'Grupo Geppos',
      connectedAt: expect.any(String),
    });
    expect(JSON.stringify(status)).not.toContain('mm-live-key-xyz');
  });

  it('does not persist when MM rejects the key', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({ ok: false, reason: 'invalid_key' }),
    }) as never;

    const { service, prisma } = setup();
    await expect(service.connect(user(), 'bad-key')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.tenantMmIntegration.upsert).not.toHaveBeenCalled();
  });

  it('does not persist when MM is unreachable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('timeout')) as never;
    const { service, prisma } = setup();
    await expect(service.connect(user(), 'mm-live-key')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    expect(prisma.tenantMmIntegration.upsert).not.toHaveBeenCalled();
  });

  it('fails closed when MM_API_BASE_URL is missing', async () => {
    const { service, prisma } = setup({ MM_API_BASE_URL: '' });
    await expect(service.connect(user(), 'mm-live-key')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(prisma.tenantMmIntegration.upsert).not.toHaveBeenCalled();
  });

  it('disconnects only the tenant link and does not wipe campaigns', async () => {
    const { service, prisma, stored } = setup();
    stored.push({
      tenantId: 'tenant-a',
      mmCompanyId: 'mm-company-gepos',
      tradeName: 'Grupo Geppos',
      apiKeyEncrypted: 'v1:iv:tag:ct',
      connectedAt: new Date('2026-09-15T12:00:00.000Z'),
    });

    await expect(service.disconnect(user())).resolves.toEqual({
      connected: false,
      mmCompanyId: null,
      tradeName: null,
      connectedAt: null,
    });
    expect(prisma.tenantMmIntegration.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a' },
    });
    expect(stored).toEqual([]);
    expect(prisma).not.toHaveProperty('couponCampaign');
  });
});
