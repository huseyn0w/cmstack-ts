import type { AdminCommentRow, CommentRepository, PostRepository } from '@cmstack-ts/db';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RecaptchaService } from '../spam/recaptcha.service';
import { CommentsService } from './comments.service';

let posts: { findPublishedIdBySlug: Mock };
let comments: Record<keyof CommentRepository, Mock>;
let recaptcha: { verify: Mock };
let service: CommentsService;

beforeEach(() => {
  posts = { findPublishedIdBySlug: vi.fn().mockResolvedValue('p1') };
  comments = {
    findApprovedById: vi.fn(),
    create: vi.fn(),
    listApprovedForPost: vi.fn(),
    listAndCount: vi.fn(),
    exists: vi.fn(),
    updateStatus: vi.fn(),
    hardDelete: vi.fn(),
  };
  recaptcha = { verify: vi.fn().mockResolvedValue(true) };
  service = new CommentsService(
    posts as unknown as PostRepository,
    comments as unknown as CommentRepository,
    recaptcha as unknown as RecaptchaService,
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

  it('stores a PENDING comment for a valid submission', async () => {
    await service.submit('slug', input);
    expect(comments.create).toHaveBeenCalledWith({
      postId: 'p1',
      parentId: null,
      authorName: 'Ada',
      authorEmail: 'ada@x.com',
      content: 'Nice post',
      status: 'PENDING',
    });
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
