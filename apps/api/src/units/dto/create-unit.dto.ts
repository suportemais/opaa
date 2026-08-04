import { IsOptional, IsString } from 'class-validator';

export class CreateUnitDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  internalCode?: string;

  @IsOptional()
  @IsString()
  timeZone?: string;

  @IsOptional()
  @IsString()
  address?: string;
}
