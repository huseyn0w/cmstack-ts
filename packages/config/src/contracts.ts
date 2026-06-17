import { z } from 'zod';

/**
 * Shared API contracts. Types live here as Zod schemas so both the NestJS API
 * (producer) and the Next.js web app (consumer) validate against the exact same
 * shape — "types are the contract". Grow this file as endpoints are added.
 */
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.string(),
  timestamp: z.string().datetime(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
