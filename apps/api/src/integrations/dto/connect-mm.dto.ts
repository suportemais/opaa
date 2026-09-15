import { IsString, MinLength } from 'class-validator';

export class ConnectMmDto {
  @IsString()
  @MinLength(1)
  apiKey!: string;
}
