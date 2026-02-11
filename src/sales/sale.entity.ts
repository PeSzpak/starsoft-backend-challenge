import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Session } from '../sessions/session.entity';
import { Reservation } from '../reservations/reservation.entity';

@Entity('sales')
@Index('idx_sale_user_confirmed_at', ['userId', 'confirmedAt'])
@Index('idx_sale_session_confirmed_at', ['sessionId', 'confirmedAt'])
export class Sale {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int' })
  sessionId: number;

  @ManyToOne(() => Session, (session) => session.sales, {
    onDelete: 'RESTRICT',
  })
  session: Session;

  @Column({ type: 'uuid', unique: true })
  reservationId: string;

  @OneToOne(() => Reservation, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'reservationId' })
  reservation: Reservation;

  @Column({ type: 'varchar', length: 100 })
  userId: string;

  @Column({ type: 'int' })
  totalCents: number;

  @CreateDateColumn({ type: 'timestamptz' })
  confirmedAt: Date;
}
