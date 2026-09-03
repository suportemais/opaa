import { IsOptional, IsString } from 'class-validator';

export class OverviewQueryDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}
