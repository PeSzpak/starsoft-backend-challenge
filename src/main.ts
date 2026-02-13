import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { RequestContextService } from './common/request-context.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const requestContext = app.get(RequestContextService);

  app.use((req: Request, res: Response, next: NextFunction) => {
    const incoming = req.headers['x-correlation-id'];
    const correlationId =
      typeof incoming === 'string' && incoming.trim().length > 0
        ? incoming
        : randomUUID();

    res.setHeader('x-correlation-id', correlationId);
    requestContext.run(correlationId, next);
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
