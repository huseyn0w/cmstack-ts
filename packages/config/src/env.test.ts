import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

const valid = {
  DATABASE_URL: 'postgresql://cmstack-ts:cmstack-ts@localhost:5432/cmstack-ts?schema=public',
  AUTH_SECRET: 'test-auth-secret-value',
  INTERNAL_API_SECRET: 'test-internal-secret-value',
};

describe('parseEnv', () => {
  it('parses a minimal valid environment and applies defaults', () => {
    const env = parseEnv(valid);
    expect(env.NODE_ENV).toBe('development');
    expect(env.API_PORT).toBe(4000);
    expect(env.NEXT_PUBLIC_API_URL).toBe('http://localhost:4000');
    expect(env.DATABASE_URL).toBe(valid.DATABASE_URL);
  });

  it('coerces a numeric port string to a number', () => {
    const env = parseEnv({ ...valid, API_PORT: '5001' });
    expect(env.API_PORT).toBe(5001);
  });

  it('leaves SMTP unset by default and applies mail defaults', () => {
    const env = parseEnv(valid);
    expect(env.SMTP_HOST).toBeUndefined();
    expect(env.SMTP_PORT).toBe(587);
    expect(env.SMTP_SECURE).toBe(false);
    expect(env.MAIL_FROM).toBe('Cmstack-TS <noreply@localhost>');
    expect(env.PASSWORD_RESET_TTL_MINUTES).toBe(60);
  });

  it('accepts a known NODE_ENV value', () => {
    expect(parseEnv({ ...valid, NODE_ENV: 'production' }).NODE_ENV).toBe('production');
  });

  it('throws a readable error when DATABASE_URL is missing', () => {
    expect(() => parseEnv({})).toThrowError(/DATABASE_URL/);
  });

  it('throws when DATABASE_URL is not a valid URL', () => {
    expect(() => parseEnv({ ...valid, DATABASE_URL: 'not-a-url' })).toThrowError(/DATABASE_URL/);
  });

  it('throws when NODE_ENV is not one of the allowed values', () => {
    expect(() => parseEnv({ ...valid, NODE_ENV: 'staging' })).toThrowError(/NODE_ENV/);
  });

  it('throws when AUTH_SECRET is too short', () => {
    expect(() => parseEnv({ ...valid, AUTH_SECRET: 'short' })).toThrowError(/AUTH_SECRET/);
  });

  it('defaults AUTH_TOKEN_TTL to 7d', () => {
    expect(parseEnv(valid).AUTH_TOKEN_TTL).toBe('7d');
  });

  it('defaults cache settings when unset', () => {
    const env = parseEnv(valid);
    expect(env.REDIS_URL).toBeUndefined();
    expect(env.CACHE_TTL_SECONDS).toBe(300);
    expect(env.CACHE_ENABLED).toBe(true);
  });

  it('parses cache settings when provided', () => {
    const env = parseEnv({
      ...valid,
      REDIS_URL: 'redis://localhost:6379',
      CACHE_TTL_SECONDS: '60',
      CACHE_ENABLED: 'false',
    });
    expect(env.REDIS_URL).toBe('redis://localhost:6379');
    expect(env.CACHE_TTL_SECONDS).toBe(60);
    expect(env.CACHE_ENABLED).toBe(false);
  });
});
