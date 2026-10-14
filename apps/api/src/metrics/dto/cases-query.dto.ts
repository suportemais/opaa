import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class CasesQueryDto {
  @IsOptional()
  @IsUUID('4')
  unitId?: string;

  /** Opcional: filtra casos por createdAt >= from (início do dia UTC). */
  @IsOptional()
  @IsDateString()
  from?: string;

  /** Opcional: filtra casos por createdAt <= to (fim do dia UTC). */
  @IsOptional()
  @IsDateString()
  to?: string;
}
