import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUUID('4')
  originUnitId?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  doNotContact?: boolean;

  @IsOptional()
  @IsString()
  doNotContactReason?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  /** aaaa-mm-dd ou dd/mm/aaaa; string vazia remove a data. */
  @IsOptional()
  @IsString()
  birthDate?: string;

  /** Registra um novo consentimento de ofertas (source 'manual'). */
  @IsOptional()
  @IsBoolean()
  acceptsOffers?: boolean;
}
