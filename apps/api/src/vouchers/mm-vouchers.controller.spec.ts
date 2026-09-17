import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Server } from 'http';
import request from 'supertest';
import {
  formatHmacSignatureHeader,
  signTimestampedBody,
} from '../domain/rewards/hmac';
import { MmRewardVerifyResponseInterceptor } from '../rewards/mm-reward-verify-response.interceptor';
import { MmAdhesionVouchersService } from './mm-adhesion-vouchers.service';
import { MmVoucherHmacGuard } from './mm-voucher-hmac.guard';
import { MmVoucherRateLimitGuard } from './mm-voucher-rate-limit.guard';
import { MmVouchersController } from './mm-vouchers.controller';

const secret = 'test-mm-secret';

describe('MmVouchersController (MM HTTP contract)', () => {
  let app: INestApplication;
  const resolve = jest.fn();
  const consume = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MmVouchersController],
      providers: [
        MmVoucherHmacGuard,
        MmVoucherRateLimitGuard,
        MmRewardVerifyResponseInterceptor,
        { provide: MmAdhesionVouchersService, useValue: { resolve, consume } },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'MM_REWARD_HMAC_SECRET') return secret;
              if (key === 'MM_REWARD_MAX_SKEW_SECONDS') return '300';
              if (key === 'MM_VOUCHER_RATE_LIMIT_PER_MINUTE') return '1000';
              if (key === 'MM_VOUCHER_RATE_LIMIT_PER_CODE_PER_MINUTE')
                return '1000';
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
    resolve.mockReset();
    consume.mockReset();
    resolve.mockResolvedValue({
      ok: true,
      voucher: '1234567',
      cnpj: '33000167000101',
      legalName: 'Empresa LTDA',
      tradeName: 'Empresa',
      amountCents: 1500,
      rules: null,
      expiresAt: '2026-10-17T00:00:00.000Z',
      status: 'unused',
    });
    consume.mockResolvedValue({
      ok: true,
      voucher: '1234567',
      status: 'used',
      usedAt: '2026-09-17T14:00:00.000Z',
      cnpj: '33000167000101',
      amountCents: 1500,
    });
  });

  it('resolves with MM HMAC headers and signs the response', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = '{"voucher":"1234567"}';
    const signature = formatHmacSignatureHeader(
      signTimestampedBody(secret, timestamp, rawBody),
    );

    const res = await request(app.getHttpServer() as Server)
      .post('/internal/mm/vouchers/resolve')
      .set('X-MM-Timestamp', timestamp)
      .set('X-MM-Signature', signature)
      .set('Content-Type', 'application/json')
      .send(rawBody)
      .expect(200);

    expect(resolve).toHaveBeenCalledWith(
      expect.objectContaining({ voucher: '1234567' }),
    );
    expect(res.body).toMatchObject({
      ok: true,
      voucher: '1234567',
      cnpj: '33000167000101',
      amountCents: 1500,
    });
    const responseTimestamp = String(res.headers['x-opiina-timestamp'] ?? '');
    expect(res.headers['x-opiina-signature']).toBe(
      `sha256=${signTimestampedBody(secret, responseTimestamp, res.text)}`,
    );
  });

  it('consumes with extra MM identity fields signed in the raw body', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = '{"voucher":"1234567","mmUserId":"u1","mmCompanyId":"c1"}';
    const signature = formatHmacSignatureHeader(
      signTimestampedBody(secret, timestamp, rawBody),
    );

    const res = await request(app.getHttpServer() as Server)
      .post('/internal/mm/vouchers/consume')
      .set('X-MM-Timestamp', timestamp)
      .set('X-MM-Signature', signature)
      .set('Content-Type', 'application/json')
      .send(rawBody)
      .expect(200);

    expect(consume).toHaveBeenCalledWith(
      expect.objectContaining({
        voucher: '1234567',
        mmUserId: 'u1',
        mmCompanyId: 'c1',
      }),
    );
    expect(res.body).toMatchObject({ ok: true, status: 'used' });
  });

  it('rejects a missing HMAC with 401', async () => {
    await request(app.getHttpServer() as Server)
      .post('/internal/mm/vouchers/resolve')
      .set('Content-Type', 'application/json')
      .send('{"voucher":"1234567"}')
      .expect(401);
  });
});
