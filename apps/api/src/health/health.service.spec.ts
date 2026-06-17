import 'reflect-metadata';
import { healthResponseSchema } from '@typress/config';
import { describe, expect, it, vi } from 'vitest';
import { HealthService } from './health.service';
import type { DatabasePinger } from './health.tokens';

const dbUp: DatabasePinger = {
  $queryRaw: vi.fn(async () => [{ '?column?': 1 }]),
};

const dbDown: DatabasePinger = {
  $queryRaw: vi.fn(async () => {
    throw new Error('connection refused');
  }),
};

describe('HealthService', () => {
  it('check() returns a payload matching the shared HealthResponse contract', () => {
    const result = new HealthService(dbUp).check();
    expect(() => healthResponseSchema.parse(result)).not.toThrow();
    expect(result.service).toBe('typress-api');
  });

  it('readiness() reports the database as up when the query succeeds', async () => {
    const result = await new HealthService(dbUp).readiness();
    expect(result).toEqual({ status: 'ok', database: 'up' });
  });

  it('readiness() reports the database as down when the query throws', async () => {
    const result = await new HealthService(dbDown).readiness();
    expect(result).toEqual({ status: 'error', database: 'down' });
  });
});
