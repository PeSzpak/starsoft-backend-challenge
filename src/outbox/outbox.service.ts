import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { OutboxEvent, OutboxStatus } from './outbox-event.entity';

@Injectable()
export class OutboxService {
  async enqueue(
    manager: EntityManager,
    eventType: string,
    payload: Record<string, unknown>,
    availableAt: Date = new Date(),
  ): Promise<void> {
    const repo = manager.getRepository(OutboxEvent);

    await repo.save(
      repo.create({
        eventType,
        payload,
        status: OutboxStatus.PENDING,
        attempts: 0,
        availableAt,
        publishedAt: null,
        lastError: null,
      }),
    );
  }
}
