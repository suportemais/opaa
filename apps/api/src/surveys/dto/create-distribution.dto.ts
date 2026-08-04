import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateDistributionDto {
  @IsUUID()
  surveyId!: string;

  @IsOptional()
  @IsUUID()
  unitId?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsString()
  channel!: string;

  @IsOptional()
  @IsString()
  campaign?: string;
}

