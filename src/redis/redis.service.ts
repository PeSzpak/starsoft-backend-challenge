import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClientType;

  constructor(private readonly configService: ConfigService) {
    this.client = createClient({
      socket: {
        host: this.configService.get<string>('REDIS_HOST', '127.0.0.1'),
        port: Number(this.configService.get<string>('REDIS_PORT', '6379')),
      },
      password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
    });

    this.client.on('error', (error: Error) => {
      this.logger.error(`Redis error: ${error.message}`);
    });
  }

  async onModuleInit(): Promise<void> {
    if (!this.client.isOpen) {
      await this.client.connect();
      this.logger.log('Redis connected');
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.quit();
    }
  }

  getClient(): RedisClientType {
    return this.client;
  }
}
