import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { sha256 } from '../common/crypto';
import { inviteLink } from '../users/user-invite';

function makeService(
  prisma: Record<string, unknown>,
  users: Record<string, unknown> = {},
) {
  const audit = { log: jest.fn() };
  const svc = new AuthService(
    {} as never,
    { get: jest.fn(), getOrThrow: jest.fn() } as never,
    users as never,
    prisma as never,
    audit as never,
    { send: jest.fn() } as never,
  );
  return { svc, audit };
}

describe('AuthService.acceptInvite', () => {
  function row(overrides: Record<string, unknown> = {}) {
    return {
      id: 'tok1',
      tenantId: 'tenant-a',
      usedAt: null,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: 'u1',
        tenantId: 'tenant-a',
        status: 'invited',
        email: 'ana@x.com',
      },
      ...overrides,
    };
  }

  it('activates the user, sets the password and consumes the token', async () => {
    const tokenUpdate = jest.fn();
    const userUpdate = jest.fn();
    const findFirst = jest.fn().mockResolvedValue(row());
    const prisma = {
      userInviteToken: { findFirst },
      $transaction: jest.fn((fn: (tx: unknown) => unknown) =>
        Promise.resolve(
          fn({
            userInviteToken: { update: tokenUpdate },
            user: { update: userUpdate },
          }),
        ),
      ),
    };
    const { svc } = makeService(prisma);

    await expect(
      svc.acceptInvite({ token: 'abc', password: 'segura123' }),
    ).resolves.toMatchObject({
      ok: true,
    });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: sha256('abc') } }),
    );
    expect(tokenUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tok1' },
        data: expect.objectContaining({ usedAt: expect.any(Date) }),
      }),
    );
    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({
          status: 'active',
          passwordHash: expect.any(String),
        }),
      }),
    );
  });

  it('rejects used, revoked or expired invites', async () => {
    for (const [override, code] of [
      [{ usedAt: new Date() }, 'invite_used'],
      [{ revokedAt: new Date() }, 'invite_revoked'],
      [{ expiresAt: new Date(Date.now() - 1000) }, 'invite_expired'],
    ] as const) {
      const { svc } = makeService({
        userInviteToken: {
          findFirst: jest.fn().mockResolvedValue(row(override)),
        },
      });
      await expect(
        svc.acceptInvite({ token: 'abc', password: 'segura123' }),
      ).rejects.toThrow(new ForbiddenException(code));
    }
  });
});

describe('AuthService.login with invited user', () => {
  it('returns a clear user_invited error', async () => {
    const { svc } = makeService(
      {},
      {
        findByEmailInTenant: jest
          .fn()
          .mockResolvedValue({
            id: 'u1',
            tenantId: 'tenant-a',
            status: 'invited',
            passwordHash: 'x',
          }),
      },
    );
    const err = await svc
      .login({
        tenantId: 'tenant-a',
        email: 'ana@x.com',
        password: 'qualquer1',
      })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UnauthorizedException);
    expect((err as UnauthorizedException).getResponse()).toMatchObject({
      code: 'user_invited',
    });
  });
});

describe('inviteLink', () => {
  it('prefers WEB_URL and includes the tenant slug', () => {
    expect(
      inviteLink({
        webUrl: 'https://app.opiina.com/',
        appBaseUrl: 'https://x',
        token: 't k',
        tenantSlug: 'acme',
      }),
    ).toBe('https://app.opiina.com/convite?token=t+k&tenant=acme');
  });
});
