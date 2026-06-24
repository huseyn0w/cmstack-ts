import type { LikeState } from '@cmstack-ts/config';
import {
  POST_LIKE_REPOSITORY,
  POST_REPOSITORY,
  type PostLikeRepository,
  type PostRepository,
  Prisma,
} from '@cmstack-ts/db';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class LikesService {
  constructor(
    @Inject(POST_REPOSITORY) private readonly posts: PostRepository,
    @Inject(POST_LIKE_REPOSITORY) private readonly likes: PostLikeRepository,
  ) {}

  private async requirePostId(slug: string): Promise<string> {
    const postId = await this.posts.findPublishedIdBySlug(slug);
    if (!postId) throw new NotFoundException('Post not found.');
    return postId;
  }

  /** Toggle the signed-in user's like on a post; returns the new state. */
  async toggle(slug: string, userId: string): Promise<LikeState> {
    const postId = await this.requirePostId(slug);
    const existing = await this.likes.findLike(postId, userId);

    try {
      if (existing) {
        await this.likes.deleteLike(postId, userId);
      } else {
        await this.likes.createLike(postId, userId);
      }
    } catch (error) {
      // Concurrent toggle already created/removed the like (P2002 unique race,
      // P2025 record-not-found). The final state is recomputed below either way.
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        !['P2002', 'P2025'].includes(error.code)
      ) {
        throw error;
      }
    }

    return this.state(slug, userId);
  }

  /** Current like state for a signed-in user. */
  async state(slug: string, userId: string): Promise<LikeState> {
    const postId = await this.requirePostId(slug);
    const [likes, mine] = await Promise.all([
      this.likes.countLikes(postId),
      this.likes.findLike(postId, userId),
    ]);
    return { likes, liked: mine !== null };
  }

  /** Public like count (for visitors who aren't signed in). */
  async publicCount(slug: string): Promise<LikeState> {
    const postId = await this.requirePostId(slug);
    const likes = await this.likes.countLikes(postId);
    return { likes, liked: false };
  }
}
