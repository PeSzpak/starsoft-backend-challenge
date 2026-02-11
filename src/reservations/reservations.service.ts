import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  PAYMENT_CONFIRMED_ROUTING_KEY,
  RESERVATION_EXPIRED_ROUTING_KEY,
} from '../messaging/messaging.constants';
import { MessagingService } from '../messaging/messaging.service';
import { RedisLockService } from '../redis/redis-lock.service';
import { Sale } from '../sales/sale.entity';
import { Seat, SeatStatus } from '../seats/seat.entity';
import { Session } from '../sessions/session.entity';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { Reservation, ReservationStatus } from './reservation.entity';
import { ReservationSeat } from './reservation-seat.entity';

@Injectable()
export class ReservationsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly redisLockService: RedisLockService,
    private readonly messagingService: MessagingService,
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
  ) {}

  async create(dto: CreateReservationDto): Promise<{
    reservationId: string;
    expiresAt: Date;
    seatNumbers: string[];
    status: ReservationStatus;
  }> {
    const session = await this.sessionRepository.findOne({
      where: { id: dto.sessionId },
    });

    if (!session) {
      throw new NotFoundException(`Session ${dto.sessionId} not found`);
    }

    const lockKeys = dto.seatNumbers.map(
      (seatNumber) => `lock:session:${dto.sessionId}:seat:${seatNumber}`,
    );
    const lockTtlMs = 5_000;
    const acquiredLocks = await this.redisLockService.acquireManyLocks(
      lockKeys,
      lockTtlMs,
    );

    if (!acquiredLocks) {
      throw new ConflictException(
        'One or more seats are being reserved by another request',
      );
    }

    try {
      const result = await this.dataSource.transaction(async (manager) => {
        const seatRepo = manager.getRepository(Seat);
        const reservationRepo = manager.getRepository(Reservation);
        const reservationSeatRepo = manager.getRepository(ReservationSeat);

        const seats = await seatRepo.find({
          where: {
            sessionId: dto.sessionId,
            seatNumber: In(dto.seatNumbers),
          },
        });

        if (seats.length !== dto.seatNumbers.length) {
          throw new NotFoundException('One or more seat numbers do not exist');
        }

        const unavailableSeats = seats.filter(
          (seat) => seat.status !== SeatStatus.AVAILABLE,
        );

        if (unavailableSeats.length > 0) {
          throw new ConflictException('One or more seats are unavailable');
        }

        const expiresAt = new Date(Date.now() + 30_000);
        const reservation = reservationRepo.create({
          sessionId: dto.sessionId,
          userId: dto.userId,
          status: ReservationStatus.PENDING,
          expiresAt,
        });

        const savedReservation = await reservationRepo.save(reservation);

        const links = seats.map((seat) =>
          reservationSeatRepo.create({
            reservationId: savedReservation.id,
            seatId: seat.id,
          }),
        );

        await reservationSeatRepo.save(links);

        seats.forEach((seat) => {
          seat.status = SeatStatus.RESERVED;
        });
        await seatRepo.save(seats);

        return {
          reservationId: savedReservation.id,
          expiresAt: savedReservation.expiresAt,
          seatNumbers: seats.map((seat) => seat.seatNumber),
          status: savedReservation.status,
        };
      });

      await this.messagingService.publishReservationCreated(
        {
          reservationId: result.reservationId,
          sessionId: dto.sessionId,
          userId: dto.userId,
          seatNumbers: result.seatNumbers,
          expiresAt: result.expiresAt.toISOString(),
        },
        30_000,
      );

      return result;
    } finally {
      await this.redisLockService.releaseManyLocks(acquiredLocks);
    }
  }

  async confirmPayment(reservationId: string): Promise<Sale> {
    const sale = await this.dataSource.transaction(async (manager) => {
      const reservationRepo = manager.getRepository(Reservation);
      const seatRepo = manager.getRepository(Seat);
      const saleRepo = manager.getRepository(Sale);

      const reservation = await reservationRepo.findOne({
        where: { id: reservationId },
        relations: {
          session: true,
          reservationSeats: {
            seat: true,
          },
        },
      });

      if (!reservation) {
        throw new NotFoundException(`Reservation ${reservationId} not found`);
      }

      if (reservation.status === ReservationStatus.CONFIRMED) {
        const existingSale = await saleRepo.findOne({
          where: { reservationId: reservation.id },
        });

        if (!existingSale) {
          throw new ConflictException('Reservation already confirmed');
        }

        return existingSale;
      }

      if (reservation.status !== ReservationStatus.PENDING) {
        throw new ConflictException('Reservation cannot be confirmed');
      }

      if (reservation.expiresAt.getTime() < Date.now()) {
        reservation.status = ReservationStatus.EXPIRED;
        await reservationRepo.save(reservation);

        const expiredSeats = reservation.reservationSeats.map(
          (item) => item.seat,
        );
        expiredSeats.forEach((seat) => {
          seat.status = SeatStatus.AVAILABLE;
        });
        await seatRepo.save(expiredSeats);

        throw new ConflictException('Reservation expired');
      }

      reservation.status = ReservationStatus.CONFIRMED;
      await reservationRepo.save(reservation);

      const reservedSeats = reservation.reservationSeats.map(
        (item) => item.seat,
      );
      reservedSeats.forEach((seat) => {
        seat.status = SeatStatus.SOLD;
      });
      await seatRepo.save(reservedSeats);

      const sale = saleRepo.create({
        sessionId: reservation.sessionId,
        reservationId: reservation.id,
        userId: reservation.userId,
        totalCents: reservedSeats.length * reservation.session.priceCents,
      });

      const savedSale = await saleRepo.save(sale);
      return savedSale;
    });

    await this.messagingService.publishEvent(PAYMENT_CONFIRMED_ROUTING_KEY, {
      reservationId,
      saleId: sale.id,
      sessionId: sale.sessionId,
      userId: sale.userId,
    });

    return sale;
  }

  async expireReservationIfPending(reservationId: string): Promise<void> {
    const expired = await this.dataSource.transaction(async (manager) => {
      const reservationRepo = manager.getRepository(Reservation);
      const seatRepo = manager.getRepository(Seat);

      const reservation = await reservationRepo.findOne({
        where: { id: reservationId },
        relations: {
          reservationSeats: {
            seat: true,
          },
        },
      });

      if (!reservation) {
        return false;
      }

      if (reservation.status !== ReservationStatus.PENDING) {
        return false;
      }

      if (reservation.expiresAt.getTime() > Date.now()) {
        return false;
      }

      reservation.status = ReservationStatus.EXPIRED;
      await reservationRepo.save(reservation);

      const seats = reservation.reservationSeats.map((item) => item.seat);
      seats.forEach((seat) => {
        seat.status = SeatStatus.AVAILABLE;
      });
      await seatRepo.save(seats);

      return true;
    });

    if (expired) {
      await this.messagingService.publishEvent(
        RESERVATION_EXPIRED_ROUTING_KEY,
        {
          reservationId,
        },
      );
    }
  }
}
