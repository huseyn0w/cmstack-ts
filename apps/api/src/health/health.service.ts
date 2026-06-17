import { Inject, Injectable } from '@nestjs/common';
import type { HealthResponse } from '@typress/config';
import { DATABASE_PINGER, type DatabasePinger } from './health.tokens';

export interface ReadinessResponse {
  status: 'ok' | 'error';
  database: 'up' | 'down';
}

@Injectable()
export class HealthService {
  constructor(@Inject(DATABASE_PINGER) private readonly db: DatabasePinger) {}

  /** Liveness: the process is up and serving. */
  check(): HealthResponse {
    return {
      status: 'ok',
      service: 'typress-api',
      timestamp: new Date().toISOString(),
    };
  }

  /** Readiness: the process can reach its dependencies (the database). */
  async readiness(): Promise<ReadinessResponse> {
    try {
      await this.db.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'up' };
    } catch {
      return { status: 'error', database: 'down' };
    }
  }
}
