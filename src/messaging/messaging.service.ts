import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqp, { Channel, ChannelModel, ConsumeMessage } from 'amqplib';
import {
  CINEMA_EVENTS_EXCHANGE,
  CINEMA_EVENTS_EXCHANGE_TYPE,
  RESERVATION_CREATED_ROUTING_KEY,
  RESERVATION_EXPIRATION_DELAY_QUEUE,
  RESERVATION_EXPIRATION_PROCESS_QUEUE,
  RESERVATION_EXPIRE_ROUTING_KEY,
} from './messaging.constants';

type PublishOptions = {
  headers?: Record<string, unknown>;
};

@Injectable()
export class MessagingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MessagingService.name);
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private connectionPromise: Promise<void> | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.ensureConnected();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.channel) {
      await this.channel.close();
      this.channel = null;
    }

    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }

  async publishEvent(
    routingKey: string,
    payload: object,
    options?: PublishOptions,
  ): Promise<void> {
    await this.ensureConnected();
    const channel = this.getChannel();

    channel.publish(
      CINEMA_EVENTS_EXCHANGE,
      routingKey,
      Buffer.from(JSON.stringify(payload)),
      {
        persistent: true,
        contentType: 'application/json',
        headers: options?.headers,
      },
    );
  }

  async publishReservationCreated(
    payload: {
      reservationId: string;
      sessionId: number;
      userId: string;
      seatNumbers: string[];
      expiresAt: string;
      correlationId?: string;
    },
    ttlMs: number,
  ): Promise<void> {
    await this.ensureConnected();
    const channel = this.getChannel();

    channel.sendToQueue(
      RESERVATION_EXPIRATION_DELAY_QUEUE,
      Buffer.from(JSON.stringify(payload)),
      {
        expiration: String(ttlMs),
        persistent: true,
        contentType: 'application/json',
        headers: {
          'x-correlation-id': payload.correlationId,
        },
      },
    );

    await this.publishEvent(RESERVATION_CREATED_ROUTING_KEY, payload, {
      headers: {
        'x-correlation-id': payload.correlationId,
      },
    });
  }

  async consume(
    queue: string,
    handler: (message: ConsumeMessage, payload: unknown) => Promise<void>,
  ): Promise<void> {
    await this.ensureConnected();
    const channel = this.getChannel();

    await channel.consume(queue, (message) => {
      if (!message) {
        return;
      }

      void (async () => {
        try {
          const raw = message.content.toString('utf8');
          const payload = JSON.parse(raw) as unknown;
          await handler(message, payload);
          channel.ack(message);
        } catch (error) {
          this.logger.error(
            `Failed to process message from ${queue}: ${String(error)}`,
          );
          channel.nack(message, false, false);
        }
      })();
    });
  }

  private async ensureConnected(): Promise<void> {
    if (this.channel) {
      return;
    }

    if (this.connectionPromise) {
      await this.connectionPromise;
      return;
    }

    this.connectionPromise = this.connect();
    try {
      await this.connectionPromise;
    } finally {
      this.connectionPromise = null;
    }
  }

  private async connect(): Promise<void> {
    const host = this.configService.get<string>('RABBITMQ_HOST', '127.0.0.1');
    const port = Number(
      this.configService.get<string>('RABBITMQ_PORT', '5672'),
    );
    const user = this.configService.get<string>('RABBITMQ_USER', 'cinema');
    const password = this.configService.get<string>(
      'RABBITMQ_PASSWORD',
      'cinema',
    );
    const vhost = this.configService.get<string>('RABBITMQ_VHOST', '/');

    const encodedVhost = encodeURIComponent(vhost);
    const url = `amqp://${user}:${password}@${host}:${port}/${encodedVhost}`;

    this.connection = await amqp.connect(url);
    this.channel = await this.connection.createChannel();

    await this.channel.assertExchange(
      CINEMA_EVENTS_EXCHANGE,
      CINEMA_EVENTS_EXCHANGE_TYPE,
      { durable: true },
    );

    await this.channel.assertQueue(RESERVATION_EXPIRATION_DELAY_QUEUE, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': CINEMA_EVENTS_EXCHANGE,
        'x-dead-letter-routing-key': RESERVATION_EXPIRE_ROUTING_KEY,
      },
    });

    await this.channel.assertQueue(RESERVATION_EXPIRATION_PROCESS_QUEUE, {
      durable: true,
    });

    await this.channel.bindQueue(
      RESERVATION_EXPIRATION_PROCESS_QUEUE,
      CINEMA_EVENTS_EXCHANGE,
      RESERVATION_EXPIRE_ROUTING_KEY,
    );

    this.logger.log('RabbitMQ connected');
  }

  private getChannel(): Channel {
    if (!this.channel) {
      throw new Error('RabbitMQ channel is not initialized');
    }

    return this.channel;
  }
}
