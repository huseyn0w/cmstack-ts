import { z } from 'zod';

/**
 * The single source of truth for Cmstack-TS runtime configuration. Every variable
 * is validated here so a misconfigured deploy fails fast at boot with a clear
 * message instead of surfacing as a confusing runtime error later.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Database — PostgreSQL by default, but the URL form is DB-agnostic via Prisma.
  DATABASE_URL: z.string().url(),

  // API (NestJS)
  API_PORT: z.coerce.number().int().positive().default(4000),

  // Secret used to sign/verify API JWTs (shared with the web app's Auth.js).
  AUTH_SECRET: z.string().min(16, 'AUTH_SECRET must be at least 16 characters'),
  // How long an issued API access token stays valid.
  AUTH_TOKEN_TTL: z.string().default('7d'),
  // Shared secret guarding server-to-server endpoints (e.g. OAuth upsert).
  INTERNAL_API_SECRET: z.string().min(16, 'INTERNAL_API_SECRET must be at least 16 characters'),

  // Media uploads: directory on disk and the maximum accepted file size (MB).
  UPLOAD_DIR: z.string().default('uploads'),
  MEDIA_MAX_SIZE_MB: z.coerce.number().int().positive().max(100).default(10),
  // Reject images above this many megapixels before decoding (decompression-bomb guard).
  MEDIA_MAX_MEGAPIXELS: z.coerce.number().int().positive().max(500).default(40),

  // Web (Next.js) — browser-facing API base URL.
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:4000'),
  // Origin allowed to call the API from the browser (CORS).
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),

  // Spam protection (Phase 8) — reCAPTCHA v3. Optional: when the secret is unset,
  // verification is skipped (so the local/demo stack runs without Google keys).
  RECAPTCHA_SECRET_KEY: z.string().optional(),
  // Minimum acceptable v3 score (0..1) when reCAPTCHA is configured.
  RECAPTCHA_MIN_SCORE: z.coerce.number().min(0).max(1).default(0.5),

  // Transactional email (SMTP). Optional: when SMTP_HOST is unset the mailer logs
  // messages to the console instead of sending (so the local/demo stack runs
  // without a real SMTP server). Set host+from (and usually user/password) for
  // real delivery.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  // The From address for outgoing mail (e.g. "Cmstack-TS <noreply@example.com>").
  MAIL_FROM: z.string().default('Cmstack-TS <noreply@localhost>'),
  // How long a password-reset token stays valid (minutes).
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(60),

  // Caching layer (feature parity §7 #10). REDIS_URL is optional: when unset, the
  // API uses an in-process memory cache (single-worker only). Set it to a redis://
  // URL for a shared, multi-worker-correct backend.
  REDIS_URL: z.string().url().optional(),
  // Default TTL (seconds) for cached public reads.
  CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  // Master switch. 'false' disables caching (every read hits the source).
  CACHE_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Pure, testable parser. Accepts a raw environment record (defaults to
 * `process.env`) and returns a validated, typed config. Throws a readable
 * aggregated error listing every offending variable.
 */
export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}
