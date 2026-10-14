import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  /** Envie string vazia para remover o telefone. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;
}
