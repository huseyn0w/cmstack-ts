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

export { PrismaClient } from '@prisma/client';
