import type { PostRepository, PostWithRelations, RevisionRepository } from '@cmstack-ts/db';
import { Prisma } from '@cmstack-ts/db';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HookRegistry } from '../plugins/hook-registry';
import type { HtmlSanitizerService } from './html-sanitizer.service';
import { PostsService } from './posts.service';

function postRow(over: Partial<PostWithRelations> = {}): PostWithRelations {
  return {
    id: 'p1',
    title: 'Title',
    slug: 'title',
    excerpt: null,
    content: 'body',
    status: 'DRAFT',
    publishedAt: null,
    metaTitle: null,
    metaDescription: null,
    canonicalUrl: null,
    noindex: false,
    authorId: 'u1',
    deletedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    author: { id: 'u1', name: 'Ada', image: null } as PostWithRelations['author'],
    categories: [],
    tags: [],
    ...over,
  } as PostWithRelations;
}

let posts: Record<keyof PostRepository, Mock>;
let revisionRepo: Record<keyof RevisionRepository, Mock>;
let sanitizer: { sanitize: Mock };
let hooks: { emit: Mock; applyFilters: Mock };
let service: PostsService;

beforeEach(() => {
  posts = {
    findPublishedIdBySlug: vi.fn(),
    create: vi.fn(),
    findById: vi.fn(),
    findActiveById: vi.fn(),
    findByIdWithTranslations: vi.fn(),
    findPublicBySlug: vi.fn(),
    publicByAuthor: vi.fn(),
    listAndCount: vi.fn(),
    update: vi.fn(),
    setDeletedAt: vi.fn(),
    restore: vi.fn(),
    findIdBySlug: vi.fn().mockResolvedValue(null),
    upsertTranslation: vi.fn(),
    deleteTranslation: vi.fn(),
    exists: vi.fn(),
    hardDelete: vi.fn(),
  };
  revisionRepo = { create: vi.fn(), listForPost: vi.fn(), listForPage: vi.fn() };
  sanitizer = { sanitize: vi.fn((s: string) => `clean:${s}`) };
  hooks = { emit: vi.fn(), applyFilters: vi.fn((_n: string, v: unknown) => v) };
  service = new PostsService(
    posts as unknown as PostRepository,
    revisionRepo as unknown as RevisionRepository,
    sanitizer as unknown as HtmlSanitizerService,
    hooks as unknown as HookRegistry,
  );
});

describe('PostsService.create', () => {
  it('a draft is not stamped published and emits no hook', async () => {
    posts.create.mockResolvedValue(postRow());
    await service.create({ title: 'T', content: '<p>x</p>' }, 'u1');
    const data = posts.create.mock.calls[0]?.[0];
    expect(data.status).toBe('DRAFT');
    expect(data.publishedAt).toBeNull();
    expect(data.content).toBe('clean:<p>x</p>'); // sanitized
    expect(hooks.emit).not.toHaveBeenCalled();
  });

  it('a published post is date-stamped and emits post.published', async () => {
    posts.create.mockResolvedValue(postRow({ status: 'PUBLISHED', slug: 'title' }));
    await service.create({ title: 'T', content: '', status: 'PUBLISHED' }, 'u1');
    const data = posts.create.mock.calls[0]?.[0];
    expect(data.status).toBe('PUBLISHED');
    expect(data.publishedAt).toBeInstanceOf(Date);
    expect(hooks.emit).toHaveBeenCalledWith('post.published', {
      id: 'p1',
      slug: 'title',
      title: 'Title',
    });
  });

  it('maps a P2025 to BadRequest and P2002 to Conflict', async () => {
    posts.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('x', { code: 'P2025', clientVersion: '6' }),
    );
    await expect(service.create({ title: 'T', content: '' }, 'u1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    posts.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('x', { code: 'P2002', clientVersion: '6' }),
    );
    await expect(service.create({ title: 'T', content: '' }, 'u1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

describe('PostsService.update', () => {
  it('throws NotFound for a missing/trashed post', async () => {
    posts.findActiveById.mockResolvedValue(null);
    await expect(service.update('x', { title: 'T' }, 'u1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(revisionRepo.create).not.toHaveBeenCalled();
  });

  it('snapshots the prior version BEFORE updating', async () => {
    posts.findActiveById.mockResolvedValue(postRow());
    posts.update.mockResolvedValue(postRow());
    await service.update('p1', { title: 'New' }, 'u9');
    expect(revisionRepo.create).toHaveBeenCalledWith({
      postId: 'p1',
      authorId: 'u9',
      snapshot: { title: 'Title', slug: 'title', excerpt: null, content: 'body', status: 'DRAFT' },
    });
    expect(revisionRepo.create.mock.invocationCallOrder[0]).toBeLessThan(
      posts.update.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('stamps publishedAt on first publish only, and fires the hook on the transition', async () => {
    posts.findActiveById.mockResolvedValue(postRow({ status: 'DRAFT', publishedAt: null }));
    posts.update.mockResolvedValue(postRow({ status: 'PUBLISHED' }));
    await service.update('p1', { status: 'PUBLISHED' }, 'u1');
    expect(posts.update.mock.calls[0]?.[1].publishedAt).toBeInstanceOf(Date);
    expect(hooks.emit).toHaveBeenCalledWith(
      'post.published',
      expect.objectContaining({ id: 'p1' }),
    );
  });

  it('does NOT restamp publishedAt or refire the hook when already published', async () => {
    posts.findActiveById.mockResolvedValue(
      postRow({ status: 'PUBLISHED', publishedAt: new Date('2020-01-01') }),
    );
    posts.update.mockResolvedValue(postRow({ status: 'PUBLISHED' }));
    await service.update('p1', { status: 'PUBLISHED', title: 'x' }, 'u1');
    expect(posts.update.mock.calls[0]?.[1].publishedAt).toBeUndefined();
    expect(hooks.emit).not.toHaveBeenCalled();
  });

  it('passes category/tag id arrays straight through to the repo', async () => {
    posts.findActiveById.mockResolvedValue(postRow());
    posts.update.mockResolvedValue(postRow());
    await service.update('p1', { categoryIds: ['c1'], tagIds: [] }, 'u1');
    expect(posts.update.mock.calls[0]?.[1]).toMatchObject({ categoryIds: ['c1'], tagIds: [] });
  });
});

describe('PostsService reads & lifecycle', () => {
  it('findPublicBySlug runs the public.post.render filter', async () => {
    posts.findPublicBySlug.mockResolvedValue(postRow({ status: 'PUBLISHED' }));
    await service.findPublicBySlug('title');
    expect(hooks.applyFilters).toHaveBeenCalledWith('public.post.render', expect.any(Object));
  });

  it('findPublicBySlug throws NotFound when absent', async () => {
    posts.findPublicBySlug.mockResolvedValue(null);
    await expect(service.findPublicBySlug('x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('softDelete stamps deletedAt after an existence check', async () => {
    posts.exists.mockResolvedValue(true);
    await service.softDelete('p1');
    expect(posts.setDeletedAt).toHaveBeenCalledWith('p1', expect.any(Date));
  });

  it('destroy hard-deletes after an existence check', async () => {
    posts.exists.mockResolvedValue(true);
    await service.destroy('p1');
    expect(posts.hardDelete).toHaveBeenCalledWith('p1');
  });

  it('revisions maps rows to ISO-dated views', async () => {
    posts.exists.mockResolvedValue(true);
    revisionRepo.listForPost.mockResolvedValue([
      {
        id: 'r1',
        authorId: 'u1',
        snapshot: { title: 'x' },
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
    ]);
    const result = await service.revisions('p1');
    expect(result[0]).toEqual({
      id: 'r1',
      authorId: 'u1',
      snapshot: { title: 'x' },
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });
});

describe('PostsService meta + localization', () => {
  it('create passes metaTitle/metaDescription through to the repo', async () => {
    posts.create.mockResolvedValue(postRow());
    await service.create({ title: 'T', content: '', metaTitle: 'MT', metaDescription: 'MD' }, 'u1');
    const data = posts.create.mock.calls[0]?.[0];
    expect(data.metaTitle).toBe('MT');
    expect(data.metaDescription).toBe('MD');
  });

  it('create passes canonicalUrl/noindex through; detail + summary surface them', async () => {
    posts.create.mockResolvedValue(
      postRow({ canonicalUrl: 'https://x.test/p', noindex: true, status: 'PUBLISHED' }),
    );
    const detail = await service.create(
      { title: 'T', content: '', canonicalUrl: 'https://x.test/p', noindex: true },
      'u1',
    );
    const data = posts.create.mock.calls[0]?.[0];
    expect(data.canonicalUrl).toBe('https://x.test/p');
    expect(data.noindex).toBe(true);
    expect(detail.canonicalUrl).toBe('https://x.test/p');
    expect(detail.noindex).toBe(true);
  });

  it('the default locale (en) reads base-only (no locale to the repo)', async () => {
    posts.findPublicBySlug.mockResolvedValue(postRow({ status: 'PUBLISHED' }));
    await service.findPublicBySlug('title', 'en');
    expect(posts.findPublicBySlug).toHaveBeenCalledWith('title', undefined);
  });

  it('a non-default locale overlays the translation per field, falling back to base', async () => {
    posts.findPublicBySlug.mockResolvedValue({
      ...postRow({ status: 'PUBLISHED', metaTitle: 'EN meta' }),
      translations: [
        {
          locale: 'de',
          title: 'DE title',
          excerpt: null,
          content: null,
          metaTitle: 'DE meta',
          metaDescription: null,
        },
      ],
    });
    const detail = await service.findPublicBySlug('title', 'de');
    expect(posts.findPublicBySlug).toHaveBeenCalledWith('title', 'de');
    expect(detail.title).toBe('DE title'); // overlaid
    expect(detail.content).toBe('body'); // null translation field -> base
    expect(detail.metaTitle).toBe('DE meta');
    expect(detail.translations).toEqual([]); // public detail does not leak the raw rows
  });

  it('public list overlays each item for the requested locale', async () => {
    posts.listAndCount.mockResolvedValue({
      items: [
        {
          ...postRow({ status: 'PUBLISHED' }),
          translations: [{ locale: 'ru', title: 'RU', excerpt: null, content: null }],
        },
      ],
      total: 1,
    });
    const list = await service.list({ page: 1, perPage: 10 } as never, { publicOnly: true }, 'ru');
    expect(posts.listAndCount.mock.calls[0]?.[1]).toBe('ru');
    expect(list.items[0]?.title).toBe('RU');
  });

  it('findById (admin) returns the post with its translation rows', async () => {
    posts.findByIdWithTranslations.mockResolvedValue({
      ...postRow(),
      translations: [
        {
          locale: 'de',
          title: 'DE',
          excerpt: null,
          content: 'dec',
          metaTitle: null,
          metaDescription: null,
        },
      ],
    });
    const detail = await service.findById('p1');
    expect(detail.translations).toEqual([
      {
        locale: 'de',
        title: 'DE',
        excerpt: null,
        content: 'dec',
        metaTitle: null,
        metaDescription: null,
      },
    ]);
  });
});

describe('PostsService.upsertTranslation', () => {
  it('sanitizes translated content and passes other fields through', async () => {
    posts.findActiveById.mockResolvedValue(postRow());
    await service.upsertTranslation('p1', 'de', { title: 'DE', content: '<b>x</b>' });
    expect(posts.upsertTranslation).toHaveBeenCalledWith('p1', 'de', {
      title: 'DE',
      content: 'clean:<b>x</b>',
    });
  });

  it('an all-empty input deletes the translation (clear)', async () => {
    posts.findActiveById.mockResolvedValue(postRow());
    await service.upsertTranslation('p1', 'de', {});
    expect(posts.deleteTranslation).toHaveBeenCalledWith('p1', 'de');
    expect(posts.upsertTranslation).not.toHaveBeenCalled();
  });

  it('an empty-string field is not stored (must fall back to base, not overlay it)', async () => {
    posts.findActiveById.mockResolvedValue(postRow());
    await service.upsertTranslation('p1', 'de', { title: 'DE', content: '', metaDescription: '' });
    expect(posts.upsertTranslation).toHaveBeenCalledWith('p1', 'de', { title: 'DE' });
  });

  it('throws NotFound when the base post is missing/trashed', async () => {
    posts.findActiveById.mockResolvedValue(null);
    await expect(service.upsertTranslation('x', 'de', { title: 'T' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(posts.upsertTranslation).not.toHaveBeenCalled();
  });

  it('deleteTranslation is a no-op-safe idempotent clear', async () => {
    posts.findActiveById.mockResolvedValue(postRow());
    posts.deleteTranslation.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('x', { code: 'P2025', clientVersion: '6' }),
    );
    await expect(service.deleteTranslation('p1', 'de')).resolves.toBeUndefined();
  });
});
