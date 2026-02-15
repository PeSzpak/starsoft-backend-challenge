import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { AppRole } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { Session } from './session.entity';
import { SessionsService } from './sessions.service';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  @Roles(AppRole.ADMIN)
  create(@Body() dto: CreateSessionDto): Promise<Session> {
    return this.sessionsService.create(dto);
  }

  @Get()
  findAll(): Promise<Session[]> {
    return this.sessionsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Session> {
    return this.sessionsService.findOne(id);
  }

  @Get(':id/availability')
  getAvailability(@Param('id', ParseIntPipe) id: number) {
    return this.sessionsService.getAvailability(id);
  }

  @Patch(':id')
  @Roles(AppRole.ADMIN)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSessionDto,
  ): Promise<Session> {
    return this.sessionsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(AppRole.ADMIN)
  async remove(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ deleted: true }> {
    await this.sessionsService.remove(id);
    return { deleted: true };
  }
}
