import type { PostLikeRepository, PostRepository } from '@cmstack-ts/db';
import { Prisma } from '@cmstack-ts/db';
import { NotFoundException } from '@nestjs/common';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { LikesService } from './likes.service';

let posts: { findPublishedIdBySlug: Mock };
let likes: Record<keyof PostLikeRepository, Mock>;
let service: LikesService;

beforeEach(() => {
  posts = { findPublishedIdBySlug: vi.fn().mockResolvedValue('p1') };
  likes = {
    findLike: vi.fn(),
    createLike: vi.fn(),
    deleteLike: vi.fn(),
    countLikes: vi.fn().mockResolvedValue(0),
  };
  service = new LikesService(
    posts as unknown as PostRepository,
    likes as unknown as PostLikeRepository,
  );
});

function knownError(code: string) {
  return new Prisma.PrismaClientKnownRequestError(code, { code, clientVersion: '6' });
}

describe('LikesService.toggle', () => {
  it('creates a like when none exists, then recomputes state', async () => {
    likes.findLike.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    likes.countLikes.mockResolvedValue(1);
    const result = await service.toggle('slug', 'u1');
    expect(likes.createLike).toHaveBeenCalledWith('p1', 'u1');
    expect(likes.deleteLike).not.toHaveBeenCalled();
    expect(result).toEqual({ likes: 1, liked: false });
  });

  it('removes the like when it already exists', async () => {
    likes.findLike.mockResolvedValueOnce({ id: 'l1' }).mockResolvedValueOnce(null);
    await service.toggle('slug', 'u1');
    expect(likes.deleteLike).toHaveBeenCalledWith('p1', 'u1');
    expect(likes.createLike).not.toHaveBeenCalled();
  });

  it('swallows a concurrent P2002/P2025 race and still returns state', async () => {
    likes.findLike.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'l1' });
    likes.createLike.mockRejectedValue(knownError('P2002'));
    likes.countLikes.mockResolvedValue(1);
    const result = await service.toggle('slug', 'u1');
    expect(result).toEqual({ likes: 1, liked: true });
  });

  it('rethrows a non-race error', async () => {
    likes.findLike.mockResolvedValue(null);
    likes.createLike.mockRejectedValue(knownError('P2000'));
    await expect(service.toggle('slug', 'u1')).rejects.toBeInstanceOf(
      Prisma.PrismaClientKnownRequestError,
    );
  });

  it('throws NotFound when the post is not published', async () => {
    posts.findPublishedIdBySlug.mockResolvedValue(null);
    await expect(service.toggle('missing', 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('LikesService.state / publicCount', () => {
  it('state reports the count and whether the user liked', async () => {
    likes.countLikes.mockResolvedValue(5);
    likes.findLike.mockResolvedValue({ id: 'l1' });
    expect(await service.state('slug', 'u1')).toEqual({ likes: 5, liked: true });
  });

  it('publicCount never reports liked for anonymous visitors', async () => {
    likes.countLikes.mockResolvedValue(9);
    expect(await service.publicCount('slug')).toEqual({ likes: 9, liked: false });
    expect(likes.findLike).not.toHaveBeenCalled();
  });
});
