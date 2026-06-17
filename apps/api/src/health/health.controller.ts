import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@typress/config';
import { HealthService, type ReadinessResponse } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  check(): HealthResponse {
    return this.health.check();
  }

  @Get('ready')
  readiness(): Promise<ReadinessResponse> {
    return this.health.readiness();
  }
}
