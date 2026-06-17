/**
 * Minimal structural contract for the database readiness probe. Depending on
 * this interface (rather than the full PrismaClient) keeps HealthService — and
 * its unit test — decoupled from the generated Prisma client.
 */
export interface DatabasePinger {
  $queryRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
}

export const DATABASE_PINGER = Symbol('DATABASE_PINGER');
