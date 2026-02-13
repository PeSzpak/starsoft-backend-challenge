import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

type RequestStore = {
  correlationId: string;
};

@Injectable()
export class RequestContextService {
  private readonly als = new AsyncLocalStorage<RequestStore>();

  run(correlationId: string, callback: () => void): void {
    this.als.run({ correlationId }, callback);
  }

  getCorrelationId(): string | undefined {
    return this.als.getStore()?.correlationId;
  }
}
