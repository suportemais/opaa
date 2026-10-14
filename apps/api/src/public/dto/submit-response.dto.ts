import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsDefined, IsEmail, IsOptional, IsString, IsUUID, Matches, ValidateNested } from 'class-validator';

export class SubmitCustomerDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  document?: string;

  /** Data de nascimento (aaaa-mm-dd). */
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'birthDate deve estar no formato aaaa-mm-dd' })
  birthDate?: string;

  /** Opt-in para receber ofertas (gera um CustomerConsent purpose='marketing_offers'). */
  @IsOptional()
  @IsBoolean()
  acceptsOffers?: boolean;
}

export class SubmitAnswerDto {
  @IsString()
  questionId!: string;

  @IsDefined()
  value!: unknown;
}

export class SubmitResponseDto {
  @IsString()
  publicToken!: string;

  @IsString()
  idempotencyKey!: string;

  @IsOptional()
  @IsUUID('4')
  employeeId?: string;

  @IsOptional()
  @IsString()
  complaint?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SubmitAnswerDto)
  answers!: SubmitAnswerDto[];

  @IsOptional()
  @IsDefined()
  clientMetadata?: unknown;

  @IsOptional()
  @ValidateNested()
  @Type(() => SubmitCustomerDto)
  customer?: SubmitCustomerDto;
}
