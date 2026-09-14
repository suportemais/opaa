import { IsOptional, IsString, MinLength } from 'class-validator';

export class RedeemRewardDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsOptional()
  @IsString()
  mmCompanyId?: string;
}
