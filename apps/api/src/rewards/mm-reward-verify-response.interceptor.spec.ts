import { of } from 'rxjs';
import { signTimestampedBody } from '../domain/rewards/hmac';
import { MmRewardVerifyResponseInterceptor } from './mm-reward-verify-response.interceptor';

const secret = 'test-mm-secret';

describe('MmRewardVerifyResponseInterceptor', () => {
  it('sets X-Opiina headers over sha256= HMAC of timestamp + raw JSON', (done) => {
    const headers: Record<string, string> = {};
    const interceptor = new MmRewardVerifyResponseInterceptor({
      get: jest.fn((key: string) =>
        key === 'MM_REWARD_HMAC_SECRET' ? secret : undefined,
      ),
    } as never);

    interceptor
      .intercept(
        {
          switchToHttp: () => ({
            getResponse: () => ({
              setHeader: (name: string, value: string) => {
                headers[name] = value;
              },
            }),
          }),
        } as never,
        { handle: () => of({ valid: false, reason: 'not_found' }) },
      )
      .subscribe((data) => {
        const raw = JSON.stringify(data);
        expect(headers['X-Opiina-Timestamp']).toMatch(/^\d+$/);
        expect(headers['X-Opiina-Signature']).toBe(
          `sha256=${signTimestampedBody(secret, headers['X-Opiina-Timestamp'], raw)}`,
        );
        done();
      });
  });
});
