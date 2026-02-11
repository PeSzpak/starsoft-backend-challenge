import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { Session } from './session.entity';
import { Seat, SeatStatus } from '../seats/seat.entity';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    @InjectRepository(Seat)
    private readonly seatRepository: Repository<Seat>,
  ) {}

  async create(dto: CreateSessionDto): Promise<Session> {
    const totalSeats = dto.totalSeats ?? 16;
    const session = this.sessionRepository.create({
      ...dto,
      totalSeats,
    });
    const savedSession = await this.sessionRepository.save(session);

    const seatNumbers = this.generateSeatNumbers(totalSeats);
    const seats = seatNumbers.map((seatNumber) =>
      this.seatRepository.create({
        sessionId: savedSession.id,
        seatNumber,
        status: SeatStatus.AVAILABLE,
      }),
    );
    await this.seatRepository.save(seats);

    return savedSession;
  }

  async findAll(): Promise<Session[]> {
    return this.sessionRepository.find({
      order: { startsAt: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Session> {
    const session = await this.sessionRepository.findOne({ where: { id } });

    if (!session) {
      throw new NotFoundException(`Session ${id} not found`);
    }

    return session;
  }

  async update(id: number, dto: UpdateSessionDto): Promise<Session> {
    const session = await this.findOne(id);

    if (dto.startsAt !== undefined) {
      session.startsAt = dto.startsAt;
    }

    if (dto.movieTitle !== undefined) {
      session.movieTitle = dto.movieTitle;
    }

    if (dto.roomName !== undefined) {
      session.roomName = dto.roomName;
    }

    if (dto.priceCents !== undefined) {
      session.priceCents = dto.priceCents;
    }

    if (dto.totalSeats !== undefined) {
      session.totalSeats = dto.totalSeats;
    }

    return this.sessionRepository.save(session);
  }

  async remove(id: number): Promise<void> {
    const session = await this.findOne(id);
    await this.sessionRepository.remove(session);
  }

  async getAvailability(id: number): Promise<{
    sessionId: number;
    totalSeats: number;
    availableSeats: number;
    reservedSeats: number;
    soldSeats: number;
    seats: Array<{
      seatNumber: string;
      status: SeatStatus;
    }>;
  }> {
    const session = await this.findOne(id);
    const seats = await this.seatRepository.find({
      where: { sessionId: id },
      order: { seatNumber: 'ASC' },
    });

    const availableSeats = seats.filter(
      (seat) => seat.status === SeatStatus.AVAILABLE,
    ).length;
    const reservedSeats = seats.filter(
      (seat) => seat.status === SeatStatus.RESERVED,
    ).length;
    const soldSeats = seats.filter(
      (seat) => seat.status === SeatStatus.SOLD,
    ).length;

    return {
      sessionId: session.id,
      totalSeats: session.totalSeats,
      availableSeats,
      reservedSeats,
      soldSeats,
      seats: seats.map((seat) => ({
        seatNumber: seat.seatNumber,
        status: seat.status,
      })),
    };
  }

  private generateSeatNumbers(totalSeats: number): string[] {
    const seatsPerRow = 8;
    return Array.from({ length: totalSeats }, (_, index) => {
      const row = String.fromCharCode(65 + Math.floor(index / seatsPerRow));
      const number = (index % seatsPerRow) + 1;
      return `${row}${number}`;
    });
  }
}
