import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Server } from 'http';
import request from 'supertest';
import {
  formatHmacSignatureHeader,
  signTimestampedBody,
} from '../domain/rewards/hmac';
import { MmRewardHmacGuard } from './mm-reward-hmac.guard';
import { MmRewardVerifyResponseInterceptor } from './mm-reward-verify-response.interceptor';
import { MmRewardsController } from './mm-rewards.controller';
import { RewardVerifyService } from './reward-verify.service';
import { RewardRedeemService } from './reward-redeem.service';

const secret = 'test-mm-secret';

describe('MmRewardsController (MM HTTP contract)', () => {
  let app: INestApplication;
  const verify = jest.fn();
  const markRedeemed = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MmRewardsController],
      providers: [
        MmRewardHmacGuard,
        MmRewardVerifyResponseInterceptor,
        { provide: RewardVerifyService, useValue: { verify } },
        { provide: RewardRedeemService, useValue: { markRedeemed } },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'MM_REWARD_HMAC_SECRET') return secret;
              if (key === 'MM_REWARD_MAX_SKEW_SECONDS') return '300';
              return undefined;
            },
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    verify.mockReset();
    markRedeemed.mockReset();
    verify.mockResolvedValue({
      valid: true,
      amount: '15.00',
      mmCompanyId: '11111111-1111-4111-8111-111111111111',
      customerKey: 'phone:5511988887777',
      expiresAt: '2026-10-01T00:00:00.000Z',
      campaignId: 'camp-1',
    });
    markRedeemed.mockResolvedValue({
      ok: true,
      code: 'MMABC12D',
      status: 'redeemed',
      redeemedAt: '2026-09-14T19:00:00.000Z',
      amount: '15.00',
      amountCents: 1500,
      mmCompanyId: '11111111-1111-4111-8111-111111111111',
      customerKey: 'phone:5511988887777',
      campaignId: 'camp-1',
    });
  });

  it('accepts MM headers + sha256= prefix and returns 200 with X-Opiina response HMAC', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = '{"code":"MMABC12D"}';
    const signature = formatHmacSignatureHeader(
      signTimestampedBody(secret, timestamp, rawBody),
    );

    const res = await request(app.getHttpServer() as Server)
      .post('/internal/mm/rewards/verify')
      .set('X-MM-Timestamp', timestamp)
      .set('X-MM-Signature', signature)
      .set('Content-Type', 'application/json')
      .send(rawBody)
      .expect(200);

    expect(res.body).toMatchObject({
      valid: true,
      amount: '15.00',
      mmCompanyId: '11111111-1111-4111-8111-111111111111',
      customerKey: 'phone:5511988887777',
      expiresAt: '2026-10-01T00:00:00.000Z',
    });
    const responseTimestamp = String(res.headers['x-opiina-timestamp'] ?? '');
    expect(responseTimestamp).toMatch(/^\d+$/);
    expect(res.headers['x-opiina-signature']).toBe(
      `sha256=${signTimestampedBody(secret, responseTimestamp, res.text)}`,
    );
  });

  it('marks redeemed with the same HMAC contract as verify', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = '{"code":"MMABC12D"}';
    const signature = formatHmacSignatureHeader(
      signTimestampedBody(secret, timestamp, rawBody),
    );

    const res = await request(app.getHttpServer() as Server)
      .post('/internal/mm/rewards/redeemed')
      .set('X-MM-Timestamp', timestamp)
      .set('X-MM-Signature', signature)
      .set('Content-Type', 'application/json')
      .send(rawBody)
      .expect(200);

    expect(markRedeemed).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'MMABC12D' }),
    );
    expect(res.body).toMatchObject({
      ok: true,
      status: 'redeemed',
      code: 'MMABC12D',
      mmCompanyId: '11111111-1111-4111-8111-111111111111',
    });
    const responseTimestamp = String(res.headers['x-opiina-timestamp'] ?? '');
    expect(res.headers['x-opiina-signature']).toBe(
      `sha256=${signTimestampedBody(secret, responseTimestamp, res.text)}`,
    );
  });

  it('rejects an invalid MM signature with 401', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    await request(app.getHttpServer() as Server)
      .post('/internal/mm/rewards/verify')
      .set('X-MM-Timestamp', timestamp)
      .set('X-MM-Signature', `sha256=${'ab'.repeat(32)}`)
      .set('Content-Type', 'application/json')
      .send('{"code":"MMABC12D"}')
      .expect(401);
  });
});
