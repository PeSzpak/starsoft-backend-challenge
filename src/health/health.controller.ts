import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { HealthService } from './health.service';

@Controller('health')
@Public()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  check() {
    return this.healthService.check();
  }
}
