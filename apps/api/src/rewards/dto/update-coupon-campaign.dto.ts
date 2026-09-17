import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateCouponCampaignDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID('4')
  surveyId?: string;

  /** Muito Mais `Company.id` (not Establishment.id / OPIINA unit). */
  @IsOptional()
  @IsString()
  @MinLength(1)
  mmCompanyId?: string;

  /** Re-snapshots the unit CNPJ when set. Required to activate a campaign without a unit. */
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  rewardAmountCents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  validityDays?: number;

  @IsOptional()
  @IsISO8601()
  startsAt?: string | null;

  @IsOptional()
  @IsISO8601()
  endsAt?: string | null;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  prefix?: string;

  @IsOptional()
  @IsIn(['draft', 'active', 'paused'])
  status?: 'draft' | 'active' | 'paused';
}
