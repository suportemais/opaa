import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { SURVEY_QUESTION_TYPES } from '../../domain/surveys/question-types';

export class SurveyQuestionOptionDto {
  @IsString()
  label!: string;

  @IsOptional()
  @IsString()
  value?: string;

  @IsOptional()
  @IsBoolean()
  negative?: boolean;
}

export class CreateSurveyQuestionDto {
  @IsString()
  title!: string;

  @IsIn(SURVEY_QUESTION_TYPES)
  type!: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsDefined()
  config?: unknown;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SurveyQuestionOptionDto)
  options?: SurveyQuestionOptionDto[];
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

  @IsOptional()
  @IsBoolean()
  anonymousAllowed?: boolean;

  @IsOptional()
  @IsBoolean()
  collectEmployee?: boolean;

  @IsArray()
  @IsUUID('4', { each: true })
  unitIds!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSurveyQuestionDto)
  questions!: CreateSurveyQuestionDto[];
}
