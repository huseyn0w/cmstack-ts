import { hash } from '@node-rs/argon2';
import { PrismaClient } from '@prisma/client';

/**
 * Demo seed. Idempotent: safe to run repeatedly. Seeds the authorization model
 * (permissions + roles) and a default administrator so the app is usable and the
 * role-gated routes are demonstrable straight after `docker compose up`.
 */
const prisma = new PrismaClient();

// (action, subject) permissions, mapped 1:1 to CASL rules.
const PERMISSIONS = [
  { action: 'manage', subject: 'all' },
  { action: 'read', subject: 'Admin' },
  { action: 'manage', subject: 'User' },
  { action: 'manage', subject: 'Role' },
] as const;

// Roles and the permissions they grant. `Member` is the safe default for new
// sign-ups: a public account with no admin access.
const ROLES: Record<
  string,
  { description: string; permissions: { action: string; subject: string }[] }
> = {
  Administrator: {
    description: 'Full access to everything.',
    permissions: [{ action: 'manage', subject: 'all' }],
  },
  Editor: {
    description: 'Can access the admin panel and manage users.',
    permissions: [
      { action: 'read', subject: 'Admin' },
      { action: 'manage', subject: 'User' },
    ],
  },
  Member: {
    description: 'A standard public account with no admin access.',
    permissions: [],
  },
};

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@typress.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'admin12345';

async function main() {
  // Permissions
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { action_subject: { action: p.action, subject: p.subject } },
      create: { action: p.action, subject: p.subject },
      update: {},
    });
  }

  // Roles (with their permission connections)
  for (const [name, def] of Object.entries(ROLES)) {
    const permissions = await prisma.permission.findMany({
      where: { OR: def.permissions.map((p) => ({ action: p.action, subject: p.subject })) },
    });
    await prisma.role.upsert({
      where: { name },
      create: {
        name,
        description: def.description,
        permissions: { connect: permissions.map((p) => ({ id: p.id })) },
      },
      update: {
        description: def.description,
        permissions: { set: permissions.map((p) => ({ id: p.id })) },
      },
    });
  }

  // Default administrator
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'Administrator' } });
  const passwordHash = await hash(ADMIN_PASSWORD);
  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    create: { email: ADMIN_EMAIL, name: 'Administrator', passwordHash, roleId: adminRole.id },
    update: { roleId: adminRole.id },
  });

  console.log(`✓ Seeded ${PERMISSIONS.length} permissions, ${Object.keys(ROLES).length} roles.`);
  console.log(`✓ Admin user: ${ADMIN_EMAIL}. Password comes from SEED_ADMIN_PASSWORD`);
  console.log('  (default "admin12345" for local dev only — set it and change in production).');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
