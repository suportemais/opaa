import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  formatHmacSignatureHeader,
  signTimestampedBody,
  signVerifyRequest,
} from '../domain/rewards/hmac';
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

  it('accepts MM-style X-MM headers and sha256= prefix over the raw body', () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = '{"code":"MMABC12D"}';
    const signature = formatHmacSignatureHeader(
      signTimestampedBody(secret, timestamp, rawBody),
    );
    expect(
      guard.canActivate(
        context({
          method: 'POST',
          headers: {
            'x-mm-timestamp': timestamp,
            'x-mm-signature': signature,
          },
          body: { code: 'MMABC12D' },
          rawBody,
        }) as never,
      ),
    ).toBe(true);
  });

  it('still accepts legacy X-OPIINA headers with bare hex', () => {
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

  it('rejects a bad signature with 401', () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    expect(() =>
      guard.canActivate(
        context({
          method: 'POST',
          headers: {
            'x-mm-timestamp': timestamp,
            'x-mm-signature': `sha256=${'00'.repeat(32)}`,
          },
          body: { code: 'MMABC12D' },
          rawBody: '{"code":"MMABC12D"}',
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
