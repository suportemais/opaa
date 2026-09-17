import { TooManyRequestsException } from '@nestjs/common';
import { MmVoucherRateLimitGuard } from './mm-voucher-rate-limit.guard';

function context(req: Record<string, unknown>) {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  };
}

describe('MmVoucherRateLimitGuard', () => {
  it('rate-limits repeated resolve attempts for the same IP', () => {
    const guard = new MmVoucherRateLimitGuard({
      get: (key: string) => {
        if (key === 'MM_VOUCHER_RATE_LIMIT_PER_MINUTE') return '2';
        if (key === 'MM_VOUCHER_RATE_LIMIT_PER_CODE_PER_MINUTE') return '20';
        return undefined;
      },
    } as never);

    const req = {
      ip: '203.0.113.9',
      headers: {},
      body: { voucher: '1234567' },
    };
    expect(guard.canActivate(context(req) as never)).toBe(true);
    expect(guard.canActivate(context(req) as never)).toBe(true);
    expect(() => guard.canActivate(context(req) as never)).toThrow(
      TooManyRequestsException,
    );
  });
});
