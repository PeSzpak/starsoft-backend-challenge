import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { Session } from './session.entity';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
  ) {}

  async create(dto: CreateSessionDto): Promise<Session> {
    const session = this.sessionRepository.create(dto);

    return this.sessionRepository.save(session);
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

    return this.sessionRepository.save(session);
  }

  async remove(id: number): Promise<void> {
    const session = await this.findOne(id);
    await this.sessionRepository.remove(session);
  }
}
