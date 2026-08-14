import { IsBoolean, IsDateString, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { WhistleblowerCategory } from '@prisma/client';

export class SubmitWhistleblowerReporterDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  doc?: string;
}

export class SubmitWhistleblowerDto {
  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;

  @IsEnum(WhistleblowerCategory)
  category!: WhistleblowerCategory;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  customCategory?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20000)
  description!: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  locationText?: string;

  @IsOptional()
  @IsUUID('4')
  unitId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  involvedPeople?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  witnesses?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  additionalInfo?: string;

  @IsOptional()
  anonymous?: boolean;

  @IsBoolean()
  truthfulnessAgreement!: boolean;

  @IsOptional()
  reporter?: SubmitWhistleblowerReporterDto;

  @IsOptional()
  clientMetadata?: unknown;
}
