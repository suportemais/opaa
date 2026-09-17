import { IsOptional, IsString, MinLength } from 'class-validator';

export class ResolveAdhesionVoucherDto {
  @IsString()
  @MinLength(1)
  voucher!: string;
}

export class ConsumeAdhesionVoucherDto {
  @IsString()
  @MinLength(1)
  voucher!: string;

  @IsOptional()
  @IsString()
  mmUserId?: string;

  @IsOptional()
  @IsString()
  mmCompanyId?: string;
}
