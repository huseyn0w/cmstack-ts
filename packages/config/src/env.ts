import { z } from 'zod';

/**
 * The single source of truth for Typress runtime configuration. Every variable
 * is validated here so a misconfigured deploy fails fast at boot with a clear
 * message instead of surfacing as a confusing runtime error later.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Database — PostgreSQL by default, but the URL form is DB-agnostic via Prisma.
  DATABASE_URL: z.string().url(),

  // API (NestJS)
  API_PORT: z.coerce.number().int().positive().default(4000),

  // Web (Next.js) — browser-facing API base URL.
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:4000'),
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
