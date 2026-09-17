import { SlidingWindowRateLimiter } from './rate-limit';

describe('SlidingWindowRateLimiter', () => {
  it('allows up to the limit then blocks until the window slides', () => {
    const limiter = new SlidingWindowRateLimiter();
    const now = 1_700_000_000_000;
    expect(limiter.tryConsume('ip:1', 2, 60_000, now).allowed).toBe(true);
    expect(limiter.tryConsume('ip:1', 2, 60_000, now + 10).allowed).toBe(true);
    const blocked = limiter.tryConsume('ip:1', 2, 60_000, now + 20);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(limiter.tryConsume('ip:1', 2, 60_000, now + 60_000).allowed).toBe(
      true,
    );
  });

  it('isolates keys so one voucher does not starve another', () => {
    const limiter = new SlidingWindowRateLimiter();
    expect(limiter.tryConsume('v:a', 1, 60_000, 1).allowed).toBe(true);
    expect(limiter.tryConsume('v:a', 1, 60_000, 2).allowed).toBe(false);
    expect(limiter.tryConsume('v:b', 1, 60_000, 2).allowed).toBe(true);
  });
});
