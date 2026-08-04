import { IsOptional, IsString } from 'class-validator';

export class CreateCaseInteractionDto {
  @IsString()
  channel!: string;

  @IsOptional()
  @IsString()
  direction?: string;

  @IsOptional()
  @IsString()
  outcome?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

