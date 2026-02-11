import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Session } from './sessions/session.entity';

@Module({
  imports: [],
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'cinema',
      password: 'cinema',
      database: 'cinema_db',
      autoLoadEntities: true,
      synchronize: true,
    }),
    TypeOrmModule.forFeature([Session]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
