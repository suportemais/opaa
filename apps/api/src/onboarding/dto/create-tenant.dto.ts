import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateTenantDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/)
  tenantSlug?: string;

  @IsString()
  legalName!: string;

  @IsString()
  tradeName!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  document?: string;

  @IsOptional()
  @IsString()
  segment?: string;

  @IsOptional()
  @IsString()
  primaryColor?: string;

  @IsOptional()
  @IsString()
  secondaryColor?: string;

  @IsString()
  adminName!: string;

  @IsEmail()
  adminEmail!: string;

  @IsString()
  @MinLength(8)
  adminPassword!: string;

  @IsString()
  unitName!: string;

  @IsOptional()
  @IsString()
  unitTimeZone?: string;
}
