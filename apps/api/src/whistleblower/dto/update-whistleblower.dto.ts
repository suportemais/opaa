import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import type { WhistleblowerPriority, WhistleblowerStatus } from '@prisma/client';

export class UpdateWhistleblowerDto {
  @IsOptional()
  @IsEnum(['received', 'analyzing', 'investigating', 'awaiting_info', 'completed', 'archived'])
  status?: WhistleblowerStatus;

  @IsOptional()
  @IsEnum(['low', 'medium', 'high', 'critical'])
  priority?: WhistleblowerPriority;

  @IsOptional()
  @IsUUID('4')
  assigneeUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  customCategory?: string;

  @IsOptional()
  notes?: string;
}

export class CreateWhistleblowerEventDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  notes!: string;
}
