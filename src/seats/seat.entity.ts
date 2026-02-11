import {
  Column,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Session } from '../sessions/session.entity';
import { ReservationSeat } from '../reservations/reservation-seat.entity';

export enum SeatStatus {
  AVAILABLE = 'AVAILABLE',
  RESERVED = 'RESERVED',
  SOLD = 'SOLD',
}

@Entity('seats')
@Unique('uq_seat_session_number', ['sessionId', 'seatNumber'])
@Index('idx_seat_session_status', ['sessionId', 'status'])
export class Seat {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  sessionId: number;

  @ManyToOne(() => Session, (session) => session.seats, {
    onDelete: 'CASCADE',
  })
  session: Session;

  @Column({ type: 'varchar', length: 10 })
  seatNumber: string;

  @Column({
    type: 'enum',
    enum: SeatStatus,
    default: SeatStatus.AVAILABLE,
  })
  status: SeatStatus;

  @OneToMany(() => ReservationSeat, (reservationSeat) => reservationSeat.seat)
  reservationSeats: ReservationSeat[];
}
