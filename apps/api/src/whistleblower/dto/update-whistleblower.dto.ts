import { IsBoolean, IsDateString, IsEmail, IsEnum, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import type { WhistleblowerCategory, WhistleblowerPriority, WhistleblowerStatus } from '@prisma/client';

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
