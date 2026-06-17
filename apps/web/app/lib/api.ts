/**
 * Shared API helpers for server-side fetches.
 *
 * Use `apiBaseUrl` for all server-to-server calls (SSR, Server Actions, route
 * handlers). Never use this on the client; client code must use
 * `process.env.NEXT_PUBLIC_API_URL` directly.
 */
export const apiBaseUrl =
  process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
