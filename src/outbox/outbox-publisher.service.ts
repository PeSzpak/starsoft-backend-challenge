import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RESERVATION_CREATED_ROUTING_KEY } from '../messaging/messaging.constants';
import { MessagingService } from '../messaging/messaging.service';
import { OutboxEvent, OutboxStatus } from './outbox-event.entity';

@Injectable()
export class OutboxPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxPublisherService.name);
  private readonly batchSize = 50;
  private readonly claimLeaseMs = 15_000;
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @InjectRepository(OutboxEvent)
    private readonly outboxRepository: Repository<OutboxEvent>,
    private readonly messagingService: MessagingService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    const pollMs = Number(this.configService.get('OUTBOX_POLL_MS', '1000'));
    this.timer = setInterval(() => {
      void this.flushPending();
    }, pollMs);
    void this.flushPending();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async flushNow(): Promise<void> {
    await this.flushPending();
  }

  private async flushPending(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    try {
      const events = await this.claimPendingBatch(this.batchSize);

      for (const event of events) {
        await this.publishOne(event);
      }
    } finally {
      this.running = false;
    }
  }

  private async publishOne(event: OutboxEvent): Promise<void> {
    try {
      const correlationId = this.getCorrelationId(event.payload);
      const headers = correlationId
        ? { 'x-correlation-id': correlationId }
        : undefined;

      if (event.eventType === RESERVATION_CREATED_ROUTING_KEY) {
        await this.publishReservationCreated(event);
      } else {
        await this.messagingService.publishEvent(
          event.eventType,
          event.payload,
          {
            headers,
          },
        );
      }

      event.status = OutboxStatus.PUBLISHED;
      event.publishedAt = new Date();
      event.lastError = null;
      await this.outboxRepository.save(event);
    } catch (error) {
      event.attempts += 1;
      event.lastError = String(error);

      if (event.attempts >= 10) {
        event.status = OutboxStatus.FAILED;
      } else {
        const delayMs = Math.min(30_000, Math.max(1, event.attempts) * 2_000);
        event.availableAt = new Date(Date.now() + delayMs);
      }

      await this.outboxRepository.save(event);
      this.logger.error(
        `Outbox publish failed for ${event.id}: ${String(error)}`,
      );
    }
  }

  private async publishReservationCreated(event: OutboxEvent): Promise<void> {
    const payload = event.payload as {
      reservationId: string;
      sessionId: number;
      userId: string;
      seatNumbers: string[];
      expiresAt: string;
      correlationId?: string;
    };

    const expiresAt = new Date(payload.expiresAt);
    const ttlMs = Math.max(0, expiresAt.getTime() - Date.now());

    await this.messagingService.publishReservationCreated(payload, ttlMs);
  }

  private getCorrelationId(
    payload: Record<string, unknown>,
  ): string | undefined {
    const value = payload.correlationId;
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  private async claimPendingBatch(limit: number): Promise<OutboxEvent[]> {
    return this.outboxRepository.manager.transaction(async (manager) => {
      const repo = manager.getRepository(OutboxEvent);

      const rawIds = await repo
        .createQueryBuilder('event')
        .select('event.id', 'id')
        .where('event.status = :status', { status: OutboxStatus.PENDING })
        .andWhere('event.availableAt <= :now', { now: new Date() })
        .orderBy('event.createdAt', 'ASC')
        .limit(limit)
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .getRawMany<{ id: string }>();

      const ids = rawIds.map((row) => row.id);

      if (ids.length === 0) {
        return [];
      }

      await repo
        .createQueryBuilder()
        .update(OutboxEvent)
        .set({ availableAt: new Date(Date.now() + this.claimLeaseMs) })
        .whereInIds(ids)
        .execute();

      return repo.find({
        where: { id: In(ids) },
        order: { createdAt: 'ASC' },
      });
    });
  }
}
