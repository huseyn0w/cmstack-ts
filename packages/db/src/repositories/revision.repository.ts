import type { Prisma, PrismaClient, Revision } from '@prisma/client';

export type RevisionCreateData = {
  postId?: string;
  pageId?: string;
  authorId: string | null;
  snapshot: Prisma.InputJsonValue;
};

/** Data access for immutable {@link Revision} snapshots. */
export interface RevisionRepository {
  create(data: RevisionCreateData): Promise<void>;
  listForPost(postId: string): Promise<Revision[]>;
  listForPage(pageId: string): Promise<Revision[]>;
}

export const REVISION_REPOSITORY = Symbol('REVISION_REPOSITORY');

export class PrismaRevisionRepository implements RevisionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: RevisionCreateData): Promise<void> {
    await this.prisma.revision.create({ data });
  }

  listForPost(postId: string): Promise<Revision[]> {
    return this.prisma.revision.findMany({ where: { postId }, orderBy: { createdAt: 'desc' } });
  }

  listForPage(pageId: string): Promise<Revision[]> {
    return this.prisma.revision.findMany({ where: { pageId }, orderBy: { createdAt: 'desc' } });
  }
}
