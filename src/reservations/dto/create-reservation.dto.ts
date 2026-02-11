import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsString,
  Min,
} from 'class-validator';

export class CreateReservationDto {
  @IsInt()
  @Min(1)
  sessionId: number;

  @IsString()
  userId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  seatNumbers: string[];
}
