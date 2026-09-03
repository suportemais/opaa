import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AccountsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}
