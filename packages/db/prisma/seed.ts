import { PrismaClient } from '@prisma/client';

/**
 * Demo seed. Phase 0 verifies the database is reachable and writable by inserting
 * a HealthCheck row. Real demo content (users, posts, pages, media) is added as
 * those models land in later phases. Keep this idempotent so re-running is safe.
 */
const prisma = new PrismaClient();

async function main() {
  const row = await prisma.healthCheck.create({ data: {} });
  const total = await prisma.healthCheck.count();
  console.log(`✓ Database reachable and writable. HealthCheck ${row.id} created (${total} total).`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
