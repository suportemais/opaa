import { IsOptional, IsUUID } from 'class-validator';

export class CasesQueryDto {
  @IsOptional()
  @IsUUID('4')
  unitId?: string;
}

