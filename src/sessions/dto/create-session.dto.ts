import { Type } from 'class-transformer';
import {
  IsDate,
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

  @Type(() => Date)
  @IsDate()
  startsAt: Date;

  @IsInt()
  @Min(1)
  priceCents: number;
}
