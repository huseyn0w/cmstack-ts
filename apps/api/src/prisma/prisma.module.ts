import { Global, Module } from '@nestjs/common';
import { prisma } from '@typress/db';

/** Injection token for the shared PrismaClient singleton. */
export const PRISMA = Symbol('PRISMA');

/**
 * Provides the single PrismaClient instance application-wide. Global so feature
 * modules can inject PRISMA without importing this module each time.
 */
@Global()
@Module({
  providers: [{ provide: PRISMA, useValue: prisma }],
  exports: [PRISMA],
})
export class PrismaModule {}
