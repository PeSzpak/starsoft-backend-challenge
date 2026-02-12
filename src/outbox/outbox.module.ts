import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxController } from './outbox.controller';
import { OutboxEvent } from './outbox-event.entity';
import { OutboxPublisherService } from './outbox-publisher.service';
import { OutboxService } from './outbox.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([OutboxEvent])],
  controllers: [OutboxController],
  providers: [OutboxService, OutboxPublisherService],
  exports: [OutboxService],
})
export class OutboxModule {}
