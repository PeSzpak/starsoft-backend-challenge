import { ConsoleLogger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { RequestContextService } from './common/request-context.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(
    new ConsoleLogger('App', {
      logLevels: ['error', 'warn', 'log', 'debug', 'verbose'],
      timestamp: true,
    }),
  );
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

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Cinema Ticket API')
    .setDescription(
      'API de reserva e venda de ingressos com controle de concorrencia',
    )
    .setVersion('1.0.0')
    .addApiKey(
      { type: 'apiKey', name: 'x-api-key', in: 'header' },
      'api-key',
    )
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, swaggerDocument);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
