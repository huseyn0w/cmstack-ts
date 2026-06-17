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
  { action: 'manage', subject: 'Post' },
  { action: 'manage', subject: 'Page' },
  { action: 'manage', subject: 'Category' },
  { action: 'manage', subject: 'Tag' },
  { action: 'manage', subject: 'Media' },
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
    description: 'Can access the admin panel and manage all content.',
    permissions: [
      { action: 'read', subject: 'Admin' },
      { action: 'manage', subject: 'Post' },
      { action: 'manage', subject: 'Page' },
      { action: 'manage', subject: 'Category' },
      { action: 'manage', subject: 'Tag' },
      { action: 'manage', subject: 'Media' },
    ],
  },
  Member: {
    description: 'A standard public account with no admin access.',
    permissions: [],
  },
};

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@typress.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'admin12345';

// Demo content so the public site has something to render after seeding.
const CATEGORIES = [
  { name: 'Announcements', slug: 'announcements', description: 'Product news and releases.' },
  { name: 'Guides', slug: 'guides', description: 'How-tos and tutorials.' },
];

const TAGS = [
  { name: 'TypeScript', slug: 'typescript' },
  { name: 'SEO', slug: 'seo' },
  { name: 'CMS', slug: 'cms' },
];

const POSTS = [
  {
    title: 'Introducing Typress',
    slug: 'introducing-typress',
    excerpt: 'A WordPress-style CMS built entirely in TypeScript — light, fast, SEO-first.',
    content:
      '<p>Typress brings the familiarity of WordPress to a modern, fully typed stack. ' +
      'It is light, fast, and SEO-first.</p><p>This post was created by the seed script.</p>',
    categorySlugs: ['announcements'],
    tagSlugs: ['typescript', 'cms'],
  },
  {
    title: 'Why SEO is first-class in Typress',
    slug: 'seo-first-class',
    excerpt: 'Server-rendered pages, structured data, sitemaps, and llms.txt out of the box.',
    content:
      '<p>Every public page is server-rendered for indexability, with Open Graph and ' +
      'JSON-LD metadata.</p><h2>Built for discovery</h2><p>Search engines and AI assistants ' +
      'can read your content.</p>',
    categorySlugs: ['guides'],
    tagSlugs: ['seo'],
  },
];

const PAGES = [
  {
    title: 'About',
    slug: 'about',
    content: '<p>Typress is an open-source, TypeScript-native CMS. This is a seeded demo page.</p>',
  },
];

// NOTE: seed HTML is trusted (authored here), so it is written directly. Any
// user-sourced content MUST go through the API's HtmlSanitizerService instead.
async function seedContent(authorId: string) {
  for (const c of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      create: c,
      update: { name: c.name, description: c.description },
    });
  }
  for (const t of TAGS) {
    await prisma.tag.upsert({ where: { slug: t.slug }, create: t, update: { name: t.name } });
  }
  for (const p of POSTS) {
    await prisma.post.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        title: p.title,
        slug: p.slug,
        excerpt: p.excerpt,
        content: p.content,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        authorId,
        categories: { connect: p.categorySlugs.map((slug) => ({ slug })) },
        tags: { connect: p.tagSlugs.map((slug) => ({ slug })) },
      },
    });
  }
  for (const pg of PAGES) {
    await prisma.page.upsert({
      where: { slug: pg.slug },
      update: {},
      create: {
        title: pg.title,
        slug: pg.slug,
        content: pg.content,
        status: 'PUBLISHED',
        authorId,
      },
    });
  }
}

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
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    create: { email: ADMIN_EMAIL, name: 'Administrator', passwordHash, roleId: adminRole.id },
    update: { roleId: adminRole.id },
  });

  await seedContent(admin.id);

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
