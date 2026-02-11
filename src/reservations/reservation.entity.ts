import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Session } from '../sessions/session.entity';
import { ReservationSeat } from './reservation-seat.entity';

export enum ReservationStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

@Entity('reservations')
@Index('idx_reservation_session_status', ['sessionId', 'status'])
@Index('idx_reservation_user_created_at', ['userId', 'createdAt'])
@Index('idx_reservation_expires_at', ['expiresAt'])
export class Reservation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int' })
  sessionId: number;

  @ManyToOne(() => Session, (session) => session.reservations, {
    onDelete: 'CASCADE',
  })
  session: Session;

  @Column({ type: 'varchar', length: 100 })
  userId: string;

  @Column({
    type: 'enum',
    enum: ReservationStatus,
    default: ReservationStatus.PENDING,
  })
  status: ReservationStatus;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(
    () => ReservationSeat,
    (reservationSeat) => reservationSeat.reservation,
    {
      cascade: true,
    },
  )
  reservationSeats: ReservationSeat[];
}
