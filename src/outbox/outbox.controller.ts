import { Controller, Get, Post } from '@nestjs/common';
import { AppRole } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { OutboxPublisherService } from './outbox-publisher.service';
import { OutboxService } from './outbox.service';

@Controller('admin/outbox')
@Roles(AppRole.ADMIN)
export class OutboxController {
  constructor(
    private readonly outboxService: OutboxService,
    private readonly outboxPublisherService: OutboxPublisherService,
  ) {}

  @Get('metrics')
  getMetrics() {
    return this.outboxService.getMetrics();
  }

  @Post('retry-failed')
  async retryFailed() {
    const requeued = await this.outboxService.requeueFailedEvents();
    await this.outboxPublisherService.flushNow();

    return {
      requeued,
      flushed: true,
    };
  }
}
