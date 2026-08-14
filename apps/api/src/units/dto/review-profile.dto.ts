import { IsEnum, IsInt, IsOptional, IsString, IsUrl, Max, Min } from 'class-validator';
import { ReviewPlatform, SyncFrequency, SyncStatus } from '@prisma/client';

export class UpdateReviewProfileDto {
  @IsOptional()
  @IsString()
  @IsUrl()
  publicUrl?: string;

  @IsOptional()
  @IsString()
  locationId?: string;

  @IsOptional()
  @IsString()
  apiKeyEncrypted?: string;

  @IsOptional()
  @IsEnum(SyncFrequency)
  syncFrequency?: SyncFrequency;

  @IsOptional()
  @IsEnum(SyncStatus)
  syncStatus?: SyncStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1)
  lastRatingPlaceholder?: number;
}

export type UpsertReviewProfileDto = {
  platform: ReviewPlatform;
  publicUrl?: string | null;
  locationId?: string | null;
  apiKeyEncrypted?: string | null;
  syncFrequency?: SyncFrequency;
  syncStatus?: SyncStatus;
};

export type ReviewPlatformCard = {
  platform: ReviewPlatform;
  averageRating: number;
  totalReviews: number;
  lastSyncAt?: string | null;
  syncStatus?: SyncStatus;
  publicUrl?: string | null;
};
