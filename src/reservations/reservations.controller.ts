import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Sale } from '../sales/sale.entity';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ReservationsService } from './reservations.service';

@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post()
  create(@Body() dto: CreateReservationDto) {
    return this.reservationsService.create(dto);
  }

  @Post(':id/confirm-payment')
  confirmPayment(@Param('id') id: string): Promise<Sale> {
    return this.reservationsService.confirmPayment(id);
  }

  @Get('users/:userId/purchases')
  getPurchaseHistory(@Param('userId') userId: string) {
    return this.reservationsService.getPurchaseHistory(userId);
  }
}
