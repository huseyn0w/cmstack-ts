import type { UserRepository } from '@cmstack-ts/db';
import { NotFoundException } from '@nestjs/common';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthorsService } from './authors.service';
import type { PostsService } from './posts.service';

let users: { findPublicProfile: Mock };
let posts: { publicByAuthor: Mock };
let service: AuthorsService;

beforeEach(() => {
  users = { findPublicProfile: vi.fn() };
  posts = { publicByAuthor: vi.fn().mockResolvedValue([]) };
  service = new AuthorsService(
    users as unknown as UserRepository,
    posts as unknown as PostsService,
  );
});

describe('AuthorsService', () => {
  it('returns the public profile plus the author posts', async () => {
    users.findPublicProfile.mockResolvedValue({
      id: 'u1',
      name: 'Ada',
      image: null,
      bio: 'hi',
    });
    posts.publicByAuthor.mockResolvedValue([{ id: 'p1' }]);
    const result = await service.getProfile('u1', 'de');
    expect(result).toEqual({
      id: 'u1',
      name: 'Ada',
      image: null,
      bio: 'hi',
      posts: [{ id: 'p1' }],
    });
    expect(posts.publicByAuthor).toHaveBeenCalledWith('u1', 'de');
  });

  it('defaults the author posts to the default locale', async () => {
    users.findPublicProfile.mockResolvedValue({ id: 'u1', name: 'Ada', image: null, bio: null });
    await service.getProfile('u1');
    expect(posts.publicByAuthor).toHaveBeenCalledWith('u1', 'en');
  });

  it('throws NotFound for an unknown author (and never lists posts)', async () => {
    users.findPublicProfile.mockResolvedValue(null);
    await expect(service.getProfile('ghost')).rejects.toBeInstanceOf(NotFoundException);
    expect(posts.publicByAuthor).not.toHaveBeenCalled();
  });
});
