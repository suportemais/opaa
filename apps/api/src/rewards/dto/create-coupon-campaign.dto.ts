import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

export class CreateCouponCampaignDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsUUID('4')
  surveyId!: string;

  /** Muito Mais `Company.id` (not Establishment.id / OPIINA unit). */
  @IsString()
  @MinLength(1)
  mmCompanyId!: string;

  /** Required when the tenant has more than one unit. Single-unit tenants auto-select. */
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  rewardAmountCents!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  validityDays?: number;

  @IsOptional()
  @IsISO8601()
  startsAt?: string;

  @IsOptional()
  @IsISO8601()
  endsAt?: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  prefix?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  activate?: boolean;
}
