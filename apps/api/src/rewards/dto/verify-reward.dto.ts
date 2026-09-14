import { IsOptional, IsString, MinLength } from 'class-validator';

export class VerifyRewardDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsOptional()
  @IsString()
  mmCompanyId?: string;
}
