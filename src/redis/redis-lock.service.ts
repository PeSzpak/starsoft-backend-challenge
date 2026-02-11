import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RedisService } from './redis.service';

export type LockHandle = {
  key: string;
  token: string;
};

@Injectable()
export class RedisLockService {
  constructor(private readonly redisService: RedisService) {}

  async acquireLock(key: string, ttlMs: number): Promise<string | null> {
    const token = randomUUID();
    const result = await this.redisService.getClient().set(key, token, {
      NX: true,
      PX: ttlMs,
    });

    if (result !== 'OK') {
      return null;
    }

    return token;
  }

  async releaseLock(key: string, token: string): Promise<boolean> {
    const result = await this.redisService.getClient().eval(
      `
      if redis.call('GET', KEYS[1]) == ARGV[1] then
        return redis.call('DEL', KEYS[1])
      else
        return 0
      end
      `,
      {
        keys: [key],
        arguments: [token],
      },
    );

    return Number(result) === 1;
  }

  async acquireManyLocks(
    keys: string[],
    ttlMs: number,
  ): Promise<LockHandle[] | null> {
    const orderedKeys = [...keys].sort();
    const acquired: LockHandle[] = [];

    for (const key of orderedKeys) {
      const token = await this.acquireLock(key, ttlMs);

      if (!token) {
        await this.releaseManyLocks(acquired);
        return null;
      }

      acquired.push({ key, token });
    }

    return acquired;
  }

  async releaseManyLocks(locks: LockHandle[]): Promise<void> {
    await Promise.allSettled(
      locks.map((lock) => this.releaseLock(lock.key, lock.token)),
    );
  }
}
