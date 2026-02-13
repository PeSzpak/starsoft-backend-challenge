import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConsumeMessage } from 'amqplib';
import { MessagingService } from '../../messaging/messaging.service';
import { RESERVATION_EXPIRATION_PROCESS_QUEUE } from '../../messaging/messaging.constants';
import { ReservationsService } from '../reservations.service';

type ReservationCreatedEvent = {
  reservationId: string;
  sessionId: number;
  userId: string;
  seatNumbers: string[];
  expiresAt: string;
  correlationId?: string;
};

@Injectable()
export class ReservationExpirationConsumer implements OnModuleInit {
  private readonly logger = new Logger(ReservationExpirationConsumer.name);

  constructor(
    private readonly messagingService: MessagingService,
    private readonly reservationsService: ReservationsService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.messagingService.consume(
      RESERVATION_EXPIRATION_PROCESS_QUEUE,
      async (message: ConsumeMessage, payload: unknown) => {
        const event = payload as ReservationCreatedEvent;
        const headerCorrelationId = message.properties.headers?.[
          'x-correlation-id'
        ] as string | undefined;
        const correlationId = event?.correlationId ?? headerCorrelationId;

        if (!event?.reservationId) {
          this.logger.warn(
            'Reservation expiration payload without reservationId',
          );
          return;
        }

        this.logger.log(
          `Processing reservation expiration for ${event.reservationId} correlationId=${correlationId ?? 'n/a'}`,
        );

        await this.reservationsService.expireReservationIfPending(
          event.reservationId,
        );
      },
    );
  }
}
