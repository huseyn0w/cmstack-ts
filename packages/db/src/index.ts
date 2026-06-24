import { PrismaClient } from '@prisma/client';

/**
 * A single PrismaClient instance per process. In development the module is
 * re-evaluated on hot reload, so we cache the client on `globalThis` to avoid
 * exhausting the database connection pool.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Re-export the generated Prisma surface (the `Prisma` namespace, `PrismaClient`,
// and every model type such as `Setting`/`Post`/…) so consumers depend on
// `@cmstack-ts/db` rather than reaching into `@prisma/client` directly.
export * from '@prisma/client';

// Repository layer (interfaces + DI tokens + Prisma implementations).
export * from './repositories';
