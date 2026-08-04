import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCustomerInteractionDto {
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

  @IsOptional()
  @IsUUID('4')
  unitId?: string;
}

