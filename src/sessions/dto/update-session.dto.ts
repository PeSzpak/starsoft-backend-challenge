import { IsISO8601, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  movieTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  roomName?: string;

  @IsOptional()
  @IsISO8601()
  startsAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  priceCents?: number;
}
