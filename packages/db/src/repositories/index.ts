// Barrel for the repository layer. Each aggregate exports its interface, its DI
// token (Symbol), and the Prisma implementation. The NestJS API binds each token
// to its implementation in the owning feature module (constructor injection of the
// shared PrismaClient).
export * from './setting.repository';
