import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { ReviewPlatform, ReviewSentiment, ReviewSyncProfile } from '@prisma/client';

export type ReviewSyncResult = {
  profileId: string;
  platform: ReviewPlatform;
  inserted: number;
  updated: number;
  skipped: number;
  averageRating: number;
  totalReviews: number;
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
};

export interface IReviewPlatformAdapter {
  readonly platform: ReviewPlatform;
  sync(profile: ReviewSyncProfile, googleApiKey?: string): Promise<ReviewSyncResult>;
}

function ratingToSentiment(rating: number): ReviewSentiment {
  if (rating >= 4) return 'positive';
  if (rating === 3) return 'neutral';
  return 'negative';
}

@Injectable()
export class GooglePlacesAdapter implements IReviewPlatformAdapter {
  readonly platform: ReviewPlatform = 'google';
  private readonly logger = new Logger(GooglePlacesAdapter.name);

  constructor(private readonly prisma: PrismaService) {}

  async sync(profile: ReviewSyncProfile, googleApiKey?: string): Promise<ReviewSyncResult> {
    if (!googleApiKey) {
      this.logger.debug(`[${profile.id}] GOOGLE_API_KEY não configurada em .env; pulando sync Google Places API.`);
      return this.emptyResult(profile);
    }
    if (!profile.locationId) {
      this.logger.debug(`[${profile.id}] profile.locationId vazio (Place ID); pulando Google sync.`);
      return this.emptyResult(profile);
    }

    const detailsUrl =
      `https://places.googleapis.com/v1/places/${encodeURIComponent(profile.locationId)}` +
      `?fields=id,displayName,reviews,rating,userRatingCount` +
      `&key=${encodeURIComponent(googleApiKey)}`;

    let payload: any;
    try {
      const res = await fetch(detailsUrl, {
        headers: { 'X-Goog-FieldMask': '*' },
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Google Places HTTP ${res.status}: ${body.slice(0, 400)}`);
      }
      payload = await res.json();
    } catch (err: any) {
      this.logger.error(`[${profile.id}] Google Places falhou: ${err?.message ?? err}`);
      throw err;
    }

    const averageRating = Number(payload.rating ?? 0);
    const totalReviews = Number(payload.userRatingCount ?? 0);

    const reviews = Array.isArray(payload.reviews) ? payload.reviews : [];
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let positiveCount = 0;
    let neutralCount = 0;
    let negativeCount = 0;

    for (const r of reviews) {
      const externalId = String(r.name ?? r.reviewId ?? r.id ?? Math.random().toString(36).slice(2));
      const rating = Number(r.rating ?? 0);
      const sentiment = ratingToSentiment(rating);
      if (sentiment === 'positive') positiveCount++;
      else if (sentiment === 'neutral') neutralCount++;
      else negativeCount++;

      const authorName = r.authorAttribution?.displayName ?? r.authorName ?? null;
      const authorAvatarUrl = r.authorAttribution?.photoUri ?? r.profilePhotoUrl ?? null;
      const title: string | null = null;
      const content = typeof r.text?.text === 'string' ? r.text.text : r.comment ?? null;
      const reviewedAt = r.publishTime ? new Date(r.publishTime) : null;
      const language = typeof r.text?.languageCode === 'string' ? r.text.languageCode : r.language ?? null;
      const metadata = { originalPublishTime: r.publishTime, originalRating: rating } as any;

      try {
        const existing = await this.prisma.review.findUnique({
          where: { tenantId_profileId_externalId: { tenantId: profile.tenantId, profileId: profile.id, externalId } },
        });
        if (!existing) {
          await this.prisma.review.create({
            data: {
              tenantId: profile.tenantId,
              unitId: profile.unitId,
              profileId: profile.id,
              platform: this.platform,
              externalId,
              authorName,
              authorAvatarUrl,
              rating,
              title,
              content,
              sentiment,
              reviewedAt,
              language,
              metadata,
            },
          });
          inserted++;
        } else {
          await this.prisma.review.update({
            where: { id: existing.id },
            data: {
              rating,
              content,
              sentiment,
              reviewedAt,
              authorName,
              authorAvatarUrl,
              language,
              metadata,
            },
          });
          updated++;
        }
      } catch (e: any) {
        this.logger.warn(`[${profile.id}] review ${externalId} skip: ${e?.code ?? e?.message}`);
        skipped++;
      }
    }

    const avg = totalReviews > 0 ? averageRating : 0;
    return {
      profileId: profile.id,
      platform: this.platform,
      inserted,
      updated,
      skipped,
      averageRating: avg,
      totalReviews,
      positiveCount,
      neutralCount,
      negativeCount,
    };
  }

  private emptyResult(profile: ReviewSyncProfile): ReviewSyncResult {
    return {
      profileId: profile.id,
      platform: this.platform,
      inserted: 0,
      updated: 0,
      skipped: 0,
      averageRating: typeof profile.lastRating === 'number' ? profile.lastRating : 0,
      totalReviews: profile.lastReviewCount ?? 0,
      positiveCount: profile.lastPositiveCount ?? 0,
      neutralCount: profile.lastNeutralCount ?? 0,
      negativeCount: profile.lastNegativeCount ?? 0,
    };
  }
}

@Injectable()
export class RssScrapeFallbackAdapter implements IReviewPlatformAdapter {
  private readonly logger: Logger;
  constructor(
    public readonly platform: ReviewPlatform,
    private readonly prisma: PrismaService,
  ) {
    this.logger = new Logger(`RssAdapter:${platform}`);
  }

  async sync(profile: ReviewSyncProfile): Promise<ReviewSyncResult> {
    this.logger.debug(`[${profile.id}] Adapter para ${this.platform} ainda não implementado (aguardando API/scraping). Placeholder.`);
    return {
      profileId: profile.id,
      platform: this.platform,
      inserted: 0,
      updated: 0,
      skipped: 0,
      averageRating: typeof profile.lastRating === 'number' ? profile.lastRating : 0,
      totalReviews: profile.lastReviewCount ?? 0,
      positiveCount: profile.lastPositiveCount ?? 0,
      neutralCount: profile.lastNeutralCount ?? 0,
      negativeCount: profile.lastNegativeCount ?? 0,
    };
  }
}
