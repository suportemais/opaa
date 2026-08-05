import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateEmployeeDto {
  @IsUUID('4')
  unitId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  roleTitle?: string;
}

