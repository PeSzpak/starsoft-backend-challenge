import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

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
}
