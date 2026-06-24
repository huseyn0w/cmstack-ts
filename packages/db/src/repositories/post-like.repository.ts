import type { PrismaClient } from '@prisma/client';

/**
 * Data access for {@link PostLike}. Mutations let Prisma's P2002/P2025 errors
 * propagate UNCAUGHT — the service relies on that for its race-resilient toggle.
 */
export interface PostLikeRepository {
  findLike(postId: string, userId: string): Promise<{ id: string } | null>;
  createLike(postId: string, userId: string): Promise<void>;
  deleteLike(postId: string, userId: string): Promise<void>;
  countLikes(postId: string): Promise<number>;
}

export const POST_LIKE_REPOSITORY = Symbol('POST_LIKE_REPOSITORY');

export class PrismaPostLikeRepository implements PostLikeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findLike(postId: string, userId: string): Promise<{ id: string } | null> {
    return this.prisma.postLike.findUnique({
      where: { postId_userId: { postId, userId } },
      select: { id: true },
    });
  }

  async createLike(postId: string, userId: string): Promise<void> {
    await this.prisma.postLike.create({ data: { postId, userId } });
  }

  async deleteLike(postId: string, userId: string): Promise<void> {
    await this.prisma.postLike.delete({ where: { postId_userId: { postId, userId } } });
  }

  countLikes(postId: string): Promise<number> {
    return this.prisma.postLike.count({ where: { postId } });
  }
}
