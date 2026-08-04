import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDefined, IsEmail, IsOptional, IsString, ValidateNested } from 'class-validator';

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
