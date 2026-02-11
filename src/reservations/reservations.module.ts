import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sale } from '../sales/sale.entity';
import { Seat } from '../seats/seat.entity';
import { Session } from '../sessions/session.entity';
import { ReservationExpirationConsumer } from './events/reservation-expiration.consumer';
import { ReservationSeat } from './reservation-seat.entity';
import { Reservation } from './reservation.entity';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Session,
      Seat,
      Reservation,
      ReservationSeat,
      Sale,
    ]),
  ],
  controllers: [ReservationsController],
  providers: [ReservationsService, ReservationExpirationConsumer],
  exports: [ReservationsService],
})
export class ReservationsModule {}
