import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsDefined, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

export class CreateSurveyQuestionDto {
  @IsString()
  title!: string;

  @IsString()
  type!: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsDefined()
  config?: unknown;
}

export class CreateSurveyDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  collectCustomer?: boolean;

  @IsArray()
  @IsUUID('4', { each: true })
  unitIds!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSurveyQuestionDto)
  questions!: CreateSurveyQuestionDto[];
}
