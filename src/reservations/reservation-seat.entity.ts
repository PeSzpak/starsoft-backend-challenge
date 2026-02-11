import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Reservation } from './reservation.entity';
import { Seat } from '../seats/seat.entity';

@Entity('reservation_seats')
@Unique('uq_reservation_seat_pair', ['reservationId', 'seatId'])
@Index('idx_reservation_seat_reservation_id', ['reservationId'])
@Index('idx_reservation_seat_seat_id', ['seatId'])
export class ReservationSeat {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'uuid' })
  reservationId: string;

  @ManyToOne(() => Reservation, (reservation) => reservation.reservationSeats, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'reservationId' })
  reservation: Reservation;

  @Column({ type: 'int' })
  seatId: number;

  @ManyToOne(() => Seat, (seat) => seat.reservationSeats, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'seatId' })
  seat: Seat;
}
