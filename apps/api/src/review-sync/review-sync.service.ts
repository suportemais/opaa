import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import type { ReviewSyncProfile, ReviewPlatform, SyncFrequency } from '@prisma/client';
import { GooglePlacesAdapter, RssScrapeFallbackAdapter, type ReviewSyncResult } from './review-platforms.adapters';

const FREQ_TO_MIN: Record<SyncFrequency, number> = {
  every30m: 30,
  hourly: 60,
  every6h: 60 * 6,
  daily: 60 * 24,
};

@Injectable()
export class ReviewSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReviewSyncService.name);
  private readonly googleAdapter: GooglePlacesAdapter;
  private readonly fallbackAdapters: Partial<Record<ReviewPlatform, RssScrapeFallbackAdapter>> = {};
  private running = false;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.googleAdapter = new GooglePlacesAdapter(prisma);
    (['ifood', 'tripadvisor', 'reclameaqui'] as ReviewPlatform[]).forEach((p) => {
      this.fallbackAdapters[p] = new RssScrapeFallbackAdapter(p, prisma);
    });
  }

  async onModuleInit() {
    this.logger.log('ReviewSyncService inicializado. Frequência de varredura global: a cada 15 minutos.');
    this.intervalHandle = setInterval(() => {
      this.tickGlobalScheduler().catch((err) => this.logger.error(`scheduler tick error: ${err?.message ?? err}`));
    }, 15 * 60 * 1000);
    setTimeout(() => {
      this.tickGlobalScheduler().catch((err) => this.logger.error(`scheduler first tick error: ${err?.message ?? err}`));
    }, 30_000);
  }

  onModuleDestroy() {
    if (this.intervalHandle) clearInterval(this.intervalHandle);
  }

  async tickGlobalScheduler() {
    if (this.running) return;
    try {
      this.running = true;
      const profiles = await this.prisma.reviewSyncProfile.findMany({
        where: { syncStatus: { not: 'paused' } },
      });
      const now = new Date();
      for (const p of profiles) {
        const min = FREQ_TO_MIN[p.syncFrequency];
        if (p.lastSyncAt && now.getTime() - p.lastSyncAt.getTime() < min * 60 * 1000) continue;
        try {
          await this.runSyncProfile(p, 'scheduler');
        } catch (err: any) {
          this.logger.error(`[scheduler][${p.id}] sync falhou: ${err?.message ?? err}`);
        }
      }
    } finally {
      this.running = false;
    }
  }

  async runSyncNow(tenantId: string, unitId: string, platform: ReviewPlatform): Promise<ReviewSyncResult> {
    const profile = await this.prisma.reviewSyncProfile.findUnique({
      where: { tenantId_unitId_platform: { tenantId, unitId, platform } },
    });
    if (!profile) {
      const placeholder = await this.prisma.reviewSyncProfile.upsert({
        where: { tenantId_unitId_platform: { tenantId, unitId, platform } },
        create: { tenantId, unitId, platform, syncFrequency: 'hourly' },
        update: {},
      });
      return this.runSyncProfile(placeholder, 'manual');
    }
    return this.runSyncProfile(profile, 'manual');
  }

  async runSyncProfile(profile: ReviewSyncProfile, origin: 'scheduler' | 'manual'): Promise<ReviewSyncResult> {
    const t0 = Date.now();
    this.logger.debug(`[${origin}][${profile.id}] iniciando sync plataforma=${profile.platform}`);
    await this.prisma.reviewSyncProfile.update({
      where: { id: profile.id },
      data: { syncStatus: 'running' },
    });

    let result: ReviewSyncResult;
    try {
      const googleApiKey = this.config.get<string>('GOOGLE_PLACES_API_KEY') ?? this.config.get<string>('GOOGLE_API_KEY');
      if (profile.platform === 'google') {
        result = await this.googleAdapter.sync(profile, googleApiKey);
      } else {
        const adapter = this.fallbackAdapters[profile.platform];
        if (!adapter) {
          result = {
            profileId: profile.id,
            platform: profile.platform,
            inserted: 0, updated: 0, skipped: 0,
            averageRating: typeof profile.lastRating === 'number' ? profile.lastRating : 0,
            totalReviews: profile.lastReviewCount ?? 0,
            positiveCount: profile.lastPositiveCount ?? 0,
            neutralCount: profile.lastNeutralCount ?? 0,
            negativeCount: profile.lastNegativeCount ?? 0,
          };
        } else {
          result = await adapter.sync(profile);
        }
      }

      await this.prisma.reviewSyncProfile.update({
        where: { id: profile.id },
        data: {
          syncStatus: 'idle',
          lastSyncAt: new Date(),
          lastError: null,
          lastRating: result.averageRating,
          lastReviewCount: result.totalReviews,
          lastPositiveCount: result.positiveCount,
          lastNeutralCount: result.neutralCount,
          lastNegativeCount: result.negativeCount,
        },
      });
    } catch (err: any) {
      await this.prisma.reviewSyncProfile.update({
        where: { id: profile.id },
        data: { syncStatus: 'error', lastSyncAt: new Date(), lastError: String(err?.message ?? err).slice(0, 5000) },
      });
      throw err;
    }

    this.logger.log(
      `[${origin}][${profile.id}] concluído platform=${profile.platform} +${result.inserted} Δ${result.updated} ?${result.skipped} avg=${result.averageRating.toFixed(2)} total=${result.totalReviews} (${(Date.now() - t0)}ms)`,
    );
    return result;
  }
}
