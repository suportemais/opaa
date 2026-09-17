import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  formatHmacSignatureHeader,
  signTimestampedBody,
} from '../domain/rewards/hmac';
import { MmVoucherHmacGuard } from './mm-voucher-hmac.guard';

const secret = 'test-mm-secret';

function context(req: Record<string, unknown>) {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  };
}

describe('MmVoucherHmacGuard', () => {
  const guard = new MmVoucherHmacGuard({
    get: jest.fn((key: string) => {
      if (key === 'MM_REWARD_HMAC_SECRET') return secret;
      if (key === 'MM_REWARD_MAX_SKEW_SECONDS') return '300';
      return undefined;
    }),
  } as never);

  it('accepts X-MM headers over the raw voucher body', () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = '{"voucher":"1234567"}';
    const signature = formatHmacSignatureHeader(
      signTimestampedBody(secret, timestamp, rawBody),
    );
    expect(
      guard.canActivate(
        context({
          headers: {
            'x-mm-timestamp': timestamp,
            'x-mm-signature': signature,
          },
          body: { voucher: '1234567' },
          rawBody,
        }) as never,
      ),
    ).toBe(true);
  });

  it('rejects extra consume fields signed only as {voucher}', () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const compact = '{"voucher":"1234567"}';
    const signature = formatHmacSignatureHeader(
      signTimestampedBody(secret, timestamp, compact),
    );
    expect(() =>
      guard.canActivate(
        context({
          headers: {
            'x-mm-timestamp': timestamp,
            'x-mm-signature': signature,
          },
          body: { voucher: '1234567', mmUserId: 'u1' },
          rawBody: '{"voucher":"1234567","mmUserId":"u1"}',
        }) as never,
      ),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a bad signature with 401', () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    expect(() =>
      guard.canActivate(
        context({
          headers: {
            'x-mm-timestamp': timestamp,
            'x-mm-signature': `sha256=${'00'.repeat(32)}`,
          },
          body: { voucher: '1234567' },
          rawBody: '{"voucher":"1234567"}',
        }) as never,
      ),
    ).toThrow(UnauthorizedException);
  });

  it('fails closed when the shared secret is missing', () => {
    const unconfigured = new MmVoucherHmacGuard({
      get: jest.fn().mockReturnValue(''),
    } as never);
    expect(() =>
      unconfigured.canActivate(
        context({ headers: {}, body: { voucher: '1234567' } }) as never,
      ),
    ).toThrow(ServiceUnavailableException);
  });
});
