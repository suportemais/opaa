import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { signVerifyRequest } from '../domain/rewards/hmac';
import { MmRewardHmacGuard } from './mm-reward-hmac.guard';

const secret = 'test-mm-secret';

function context(req: Record<string, unknown>) {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  };
}

describe('MmRewardHmacGuard', () => {
  const guard = new MmRewardHmacGuard({
    get: jest.fn((key: string) => {
      if (key === 'MM_REWARD_HMAC_SECRET') return secret;
      if (key === 'MM_REWARD_MAX_SKEW_SECONDS') return '300';
      return undefined;
    }),
  } as never);

  it('accepts a fresh HMAC-signed verify POST', () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = { code: 'MMABC12D' };
    const signature = signVerifyRequest({ timestamp, body, secret });
    expect(
      guard.canActivate(
        context({
          method: 'POST',
          headers: {
            'x-opiina-timestamp': timestamp,
            'x-opiina-signature': signature,
          },
          body,
        }) as never,
      ),
    ).toBe(true);
  });

  it('rejects a bad signature', () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    expect(() =>
      guard.canActivate(
        context({
          method: 'POST',
          headers: {
            'x-opiina-timestamp': timestamp,
            'x-opiina-signature': '00'.repeat(32),
          },
          body: { code: 'MMABC12D' },
        }) as never,
      ),
    ).toThrow(UnauthorizedException);
  });

  it('fails closed when the shared secret is missing', () => {
    const unconfigured = new MmRewardHmacGuard({
      get: jest.fn().mockReturnValue(''),
    } as never);
    expect(() =>
      unconfigured.canActivate(
        context({ method: 'POST', headers: {}, body: { code: 'X' } }) as never,
      ),
    ).toThrow(ServiceUnavailableException);
  });
});
