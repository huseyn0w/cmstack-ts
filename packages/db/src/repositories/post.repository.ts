import type { PrismaClient } from '@prisma/client';

/**
 * Data access for {@link Post}. Grown incrementally: today it exposes the shared
 * published-post lookup used by Likes and Comments; the full authoring surface is
 * added when the Posts domain is refactored. Post is the aggregate that OWNS this
 * read (it queries the Post model), so neither the like nor the comment repository
 * duplicates it.
 */
export interface PostRepository {
  /** Id of a PUBLISHED, non-trashed post by slug, or null. */
  findPublishedIdBySlug(slug: string): Promise<string | null>;
}

export const POST_REPOSITORY = Symbol('POST_REPOSITORY');

export class PrismaPostRepository implements PostRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findPublishedIdBySlug(slug: string): Promise<string | null> {
    const post = await this.prisma.post.findFirst({
      where: { slug, status: 'PUBLISHED', deletedAt: null },
      select: { id: true },
    });
    return post?.id ?? null;
  }
}
