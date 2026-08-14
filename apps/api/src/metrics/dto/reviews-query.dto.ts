import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ReviewPlatform, ReviewSentiment } from '@prisma/client';

export class ReviewsQueryDto {
  @IsOptional()
  @IsString()
  unitId?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsEnum(ReviewPlatform, { each: true })
  platforms?: ReviewPlatform[];

  @IsOptional()
  @IsEnum(ReviewSentiment, { each: true })
  sentiments?: ReviewSentiment[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}
