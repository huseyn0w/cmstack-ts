// Barrel for the repository layer. Each aggregate exports its interface, its DI
// token (Symbol), and the Prisma implementation. The NestJS API binds each token
// to its implementation in the owning feature module (constructor injection of the
// shared PrismaClient).
export * from './crud.repository';
export * from './setting.repository';
export * from './site-profile.repository';
export * from './service.repository';
export * from './faq.repository';
export * from './tag.repository';
export * from './category.repository';
export * from './media.repository';
export * from './post.repository';
export * from './post-like.repository';
