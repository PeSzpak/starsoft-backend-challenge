import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AppRole } from '../auth/auth.types';
import type { AuthUser } from '../auth/auth.types';
import { Sale } from '../sales/sale.entity';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ReservationsService } from './reservations.service';

@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post()
  create(@Body() dto: CreateReservationDto, @CurrentUser() user: AuthUser) {
    if (user.role === AppRole.USER && dto.userId !== user.id) {
      throw new ForbiddenException(
        'Users can only create reservations for themselves',
      );
    }

    return this.reservationsService.create(dto);
  }

  @Post(':id/confirm-payment')
  confirmPayment(@Param('id') id: string): Promise<Sale> {
    return this.reservationsService.confirmPayment(id);
  }

  @Get('users/:userId/purchases')
  getPurchaseHistory(
    @Param('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    if (user.role === AppRole.USER && userId !== user.id) {
      throw new ForbiddenException('Users can only access their own purchases');
    }

    return this.reservationsService.getPurchaseHistory(userId);
  }
}
