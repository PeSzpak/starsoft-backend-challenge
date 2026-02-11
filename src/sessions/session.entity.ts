import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Reservation } from '../reservations/reservation.entity';
import { Sale } from '../sales/sale.entity';
import { Seat } from '../seats/seat.entity';

@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 120 })
  movieTitle: string;

  @Column({ type: 'varchar', length: 50 })
  roomName: string;

  @Column({ type: 'timestamptz' })
  startsAt: Date;

  @Column({ type: 'int' })
  priceCents: number;

  @Column({ type: 'int', default: 16 })
  totalSeats: number;

  @OneToMany(() => Seat, (seat) => seat.session)
  seats: Seat[];

  @OneToMany(() => Reservation, (reservation) => reservation.session)
  reservations: Reservation[];

  @OneToMany(() => Sale, (sale) => sale.session)
  sales: Sale[];
}
