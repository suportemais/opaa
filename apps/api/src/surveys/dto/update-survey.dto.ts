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

export class UpdateSurveyQuestionDto {
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
}

export class UpdateSurveyDto {
  @IsOptional()
  @IsString()
  name?: string;

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

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  unitIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateSurveyQuestionDto)
  questions?: UpdateSurveyQuestionDto[];
}
