import {
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateSessionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  movieTitle: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  roomName: string;

  @IsISO8601()
  startsAt: string;

  @IsInt()
  @Min(1)
  priceCents: number;
}
