import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PrismaPostLikeRepository } from './post-like.repository';
import { PrismaPostRepository } from './post.repository';

describe('PrismaPostRepository.findPublishedIdBySlug', () => {
  function make() {
    const post = { findFirst: vi.fn() };
    const prisma = { post } as unknown as PrismaClient;
    return { repo: new PrismaPostRepository(prisma), post };
  }

  it('queries published, non-trashed posts by slug and returns the id', async () => {
    const { repo, post } = make();
    post.findFirst.mockResolvedValue({ id: 'p1' });
    expect(await repo.findPublishedIdBySlug('hello')).toBe('p1');
    expect(post.findFirst).toHaveBeenCalledWith({
      where: { slug: 'hello', status: 'PUBLISHED', deletedAt: null },
      select: { id: true },
    });
  });

  it('returns null when no published post matches', async () => {
    const { repo, post } = make();
    post.findFirst.mockResolvedValue(null);
    expect(await repo.findPublishedIdBySlug('missing')).toBeNull();
  });
});

describe('PrismaPostLikeRepository', () => {
  function make() {
    const postLike = { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn(), count: vi.fn() };
    const prisma = { postLike } as unknown as PrismaClient;
    return { repo: new PrismaPostLikeRepository(prisma), postLike };
  }

  it('findLike() uses the composite key and selects only the id', async () => {
    const { repo, postLike } = make();
    postLike.findUnique.mockResolvedValue({ id: 'l1' });
    await repo.findLike('p1', 'u1');
    expect(postLike.findUnique).toHaveBeenCalledWith({
      where: { postId_userId: { postId: 'p1', userId: 'u1' } },
      select: { id: true },
    });
  });

  it('createLike()/deleteLike() target the right row and let errors propagate', async () => {
    const { repo, postLike } = make();
    postLike.create.mockResolvedValue({});
    postLike.delete.mockResolvedValue({});
    await repo.createLike('p1', 'u1');
    await repo.deleteLike('p1', 'u1');
    expect(postLike.create).toHaveBeenCalledWith({ data: { postId: 'p1', userId: 'u1' } });
    expect(postLike.delete).toHaveBeenCalledWith({
      where: { postId_userId: { postId: 'p1', userId: 'u1' } },
    });
  });

  it('countLikes() counts by postId', async () => {
    const { repo, postLike } = make();
    postLike.count.mockResolvedValue(3);
    expect(await repo.countLikes('p1')).toBe(3);
    expect(postLike.count).toHaveBeenCalledWith({ where: { postId: 'p1' } });
  });
});
