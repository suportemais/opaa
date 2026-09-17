import { Type } from 'class-transformer';
import {
  IsInt,
  IsObject,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class CreateAdhesionVoucherDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  amountCents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  validityDays?: number;

  @IsOptional()
  @IsObject()
  rules?: Record<string, unknown>;
}
