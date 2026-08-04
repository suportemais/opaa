import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { PrismaService } from './prisma/prisma.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: PrismaService,
          useValue: { $queryRaw: jest.fn().mockResolvedValue(1) },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('returns health', () => {
    expect(appController.health()).toEqual({ status: 'ok' });
  });

  it('returns ready', async () => {
    await expect(appController.ready()).resolves.toEqual({ status: 'ready' });
  });
});
