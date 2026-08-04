import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class NpsQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsUUID('4')
  unitId?: string;
}

