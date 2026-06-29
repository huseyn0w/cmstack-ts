import type { AdminCommentRow, CommentRepository, PostRepository } from '@cmstack-ts/db';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RecaptchaService } from '../spam/recaptcha.service';
import { CommentsService } from './comments.service';

let posts: { findPublishedIdBySlug: Mock };
let comments: Record<keyof CommentRepository, Mock>;
let recaptcha: { verify: Mock };
let hooks: { emit: Mock };
let service: CommentsService;

const createdRow = {
  id: 'c1',
  authorName: 'Ada',
  content: 'Nice post',
  post: { slug: 'slug', title: 'My Post' },
};

beforeEach(() => {
  posts = { findPublishedIdBySlug: vi.fn().mockResolvedValue('p1') };
  comments = {
    findApprovedById: vi.fn(),
    create: vi.fn().mockResolvedValue(createdRow),
    listApprovedForPost: vi.fn().mockResolvedValue([]),
    listOwnForPost: vi.fn().mockResolvedValue([]),
    findOwnedById: vi.fn(),
    updateOwnContent: vi.fn(),
    listAndCount: vi.fn(),
    exists: vi.fn(),
    updateStatus: vi.fn(),
    hardDelete: vi.fn(),
  };
  recaptcha = { verify: vi.fn().mockResolvedValue(true) };
  hooks = { emit: vi.fn().mockResolvedValue(undefined) };
  service = new CommentsService(
    posts as unknown as PostRepository,
    comments as unknown as CommentRepository,
    recaptcha as unknown as RecaptchaService,
    hooks as never,
  );
});

const input = {
  authorName: 'Ada',
  authorEmail: 'ada@x.com',
  content: 'Nice post',
  recaptchaToken: 't',
};

describe('CommentsService.submit', () => {
  it('rejects when the spam check fails', async () => {
    recaptcha.verify.mockResolvedValue(false);
    await expect(service.submit('slug', input)).rejects.toBeInstanceOf(BadRequestException);
    expect(comments.create).not.toHaveBeenCalled();
  });

  it('throws NotFound when the post is not published', async () => {
    posts.findPublishedIdBySlug.mockResolvedValue(null);
    await expect(service.submit('slug', input)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a reply whose parent is not an approved comment on the post', async () => {
    comments.findApprovedById.mockResolvedValue(null);
    await expect(service.submit('slug', { ...input, parentId: 'x' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(comments.create).not.toHaveBeenCalled();
  });

  it('stores a PENDING, unattributed comment for a valid guest submission', async () => {
    await service.submit('slug', input);
    expect(comments.create).toHaveBeenCalledWith({
      postId: 'p1',
      parentId: null,
      authorName: 'Ada',
      authorEmail: 'ada@x.com',
      content: 'Nice post',
      status: 'PENDING',
      userId: null,
    });
  });

  it('rejects a guest submission missing name/email', async () => {
    await expect(
      service.submit('slug', { content: 'hi', recaptchaToken: 't' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(comments.create).not.toHaveBeenCalled();
  });

  it('attributes a signed-in author (userId + snapshot, skips recaptcha + body name/email)', async () => {
    recaptcha.verify.mockResolvedValue(false); // would reject a guest; ignored for a viewer
    await service.submit(
      'slug',
      { content: 'Nice post' },
      { id: 'u9', name: 'Grace', email: 'grace@x.com' },
    );
    expect(recaptcha.verify).not.toHaveBeenCalled();
    expect(comments.create).toHaveBeenCalledWith({
      postId: 'p1',
      parentId: null,
      authorName: 'Grace',
      authorEmail: 'grace@x.com',
      content: 'Nice post',
      status: 'PENDING',
      userId: 'u9',
    });
  });

  it('emits comment.submitted (without author email) so the moderator is notified', async () => {
    await service.submit('slug', input);
    expect(hooks.emit).toHaveBeenCalledWith('comment.submitted', {
      id: 'c1',
      postSlug: 'slug',
      postTitle: 'My Post',
      authorName: 'Ada',
      content: 'Nice post',
    });
    const payload = hooks.emit.mock.calls[0]?.[1];
    expect(payload).not.toHaveProperty('authorEmail');
  });
});

describe('CommentsService.listForPost', () => {
  it('threads approved rows and never exposes author email', async () => {
    comments.listApprovedForPost.mockResolvedValue([
      {
        id: 'c1',
        parentId: null,
        authorName: 'Ada',
        content: 'hi',
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
    ]);
    const result = await service.listForPost('slug');
    expect(result.total).toBe(1);
    expect(result.items[0]).not.toHaveProperty('authorEmail');
    expect(result.items[0]?.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(comments.listOwnForPost).not.toHaveBeenCalled(); // no viewer → no own merge
  });

  it("merges the viewer's own pending comment (flagged mine/pending); total counts approved only", async () => {
    comments.listApprovedForPost.mockResolvedValue([
      {
        id: 'c1',
        parentId: null,
        authorName: 'Ada',
        content: 'approved',
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
    ]);
    comments.listOwnForPost.mockResolvedValue([
      {
        id: 'c2',
        parentId: null,
        authorName: 'Me',
        content: 'pending mine',
        createdAt: new Date('2026-01-02T00:00:00Z'),
        status: 'PENDING',
      },
    ]);
    const result = await service.listForPost('slug', 'u9');
    expect(comments.listOwnForPost).toHaveBeenCalledWith('p1', 'u9');
    expect(result.total).toBe(1); // approved-only count
    const mine = result.items.find((i) => i.id === 'c2');
    expect(mine?.mine).toBe(true);
    expect(mine?.pending).toBe(true);
  });
});

describe('CommentsService self-edit', () => {
  const viewer = { id: 'u9', name: 'Me', email: 'me@x.com' };
  const owned = (createdAt: Date) => ({
    id: 'c1',
    status: 'APPROVED' as const,
    createdAt,
    post: { slug: 's' },
  });

  it('editOwn updates content (re-moderation) within the window', async () => {
    comments.findOwnedById.mockResolvedValue(owned(new Date()));
    const res = await service.editOwn('c1', viewer, 'edited');
    expect(comments.findOwnedById).toHaveBeenCalledWith('c1', 'u9');
    expect(comments.updateOwnContent).toHaveBeenCalledWith('c1', 'edited');
    expect(res.status).toBe('PENDING');
  });

  it('editOwn 404s when the comment is not owned by the viewer', async () => {
    comments.findOwnedById.mockResolvedValue(null);
    await expect(service.editOwn('c1', viewer, 'x')).rejects.toBeInstanceOf(NotFoundException);
    expect(comments.updateOwnContent).not.toHaveBeenCalled();
  });

  it('editOwn is forbidden once the edit window has passed', async () => {
    comments.findOwnedById.mockResolvedValue(owned(new Date(Date.now() - 60 * 60_000)));
    await expect(service.editOwn('c1', viewer, 'x')).rejects.toBeInstanceOf(ForbiddenException);
    expect(comments.updateOwnContent).not.toHaveBeenCalled();
  });

  it('deleteOwn hard-deletes an owned comment within the window', async () => {
    comments.findOwnedById.mockResolvedValue(owned(new Date()));
    await service.deleteOwn('c1', viewer);
    expect(comments.hardDelete).toHaveBeenCalledWith('c1');
  });

  it('deleteOwn 404s when not owned', async () => {
    comments.findOwnedById.mockResolvedValue(null);
    await expect(service.deleteOwn('c1', viewer)).rejects.toBeInstanceOf(NotFoundException);
    expect(comments.hardDelete).not.toHaveBeenCalled();
  });
});

describe('CommentsService admin', () => {
  const adminRow = {
    id: 'c1',
    parentId: null,
    authorName: 'Ada',
    authorEmail: 'ada@x.com',
    content: 'hi',
    status: 'PENDING',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    post: { slug: 's', title: 'T' },
  } as unknown as AdminCommentRow;

  it('moderate checks existence then updates status and maps the admin view', async () => {
    comments.exists.mockResolvedValue(true);
    comments.updateStatus.mockResolvedValue(adminRow);
    const result = await service.moderate('c1', { status: 'APPROVED' });
    expect(comments.updateStatus).toHaveBeenCalledWith('c1', 'APPROVED');
    expect(result).toMatchObject({ id: 'c1', postSlug: 's', postTitle: 'T' });
  });

  it('moderate throws NotFound when absent', async () => {
    comments.exists.mockResolvedValue(false);
    await expect(service.moderate('missing', { status: 'SPAM' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(comments.updateStatus).not.toHaveBeenCalled();
  });

  it('remove checks existence then hard-deletes', async () => {
    comments.exists.mockResolvedValue(true);
    await service.remove('c1');
    expect(comments.hardDelete).toHaveBeenCalledWith('c1');
  });
});
