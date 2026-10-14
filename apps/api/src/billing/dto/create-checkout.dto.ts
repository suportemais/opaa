import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateCheckoutDto {
  /** Slug do plano; se omitido usa o plano atual do tenant. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-z0-9-]+$/)
  planSlug?: string;
}
