import { IsIn, IsOptional, IsUUID, ValidateIf } from 'class-validator';

export class GrantAccessDto {
  @IsUUID()
  planId!: string;

  /** ISO date. Omit or null = sem validade (acesso contínuo). */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  accessValidUntil?: string | null;

  @IsIn(['manual', 'cortesia', 'trial_grant'])
  reason!: 'manual' | 'cortesia' | 'trial_grant';
}
