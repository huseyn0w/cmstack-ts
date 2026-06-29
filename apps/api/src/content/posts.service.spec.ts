import type { PostRepository, PostWithRelations, RevisionRepository } from '@cmstack-ts/db';
import { Prisma } from '@cmstack-ts/db';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CacheService } from '../cache/cache.service';
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
    scheduledAt: null,
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
let cache: { getOrSet: Mock; invalidate: Mock };
let service: PostsService;

beforeEach(() => {
  posts = {
    findPublishedIdBySlug: vi.fn(),
    slugsByIds: vi.fn(),
    create: vi.fn(),
    findById: vi.fn(),
    findActiveById: vi.fn(),
    findByIdWithTranslations: vi.fn(),
    findPublicBySlug: vi.fn(),
    findRelatedPublic: vi.fn(),
    publicByAuthor: vi.fn(),
    listAndCount: vi.fn(),
    update: vi.fn(),
    setDeletedAt: vi.fn(),
    restore: vi.fn(),
    findIdBySlug: vi.fn().mockResolvedValue(null),
    findDueScheduledIds: vi.fn(),
    upsertTranslation: vi.fn(),
    deleteTranslation: vi.fn(),
    exists: vi.fn(),
    hardDelete: vi.fn(),
  };
  revisionRepo = { create: vi.fn(), listForPost: vi.fn(), listForPage: vi.fn(), findById: vi.fn() };
  sanitizer = { sanitize: vi.fn((s: string) => `clean:${s}`) };
  hooks = {
    emit: vi.fn().mockResolvedValue(undefined),
    applyFilters: vi.fn((_n: string, v: unknown) => v),
  };
  cache = {
    getOrSet: vi.fn((_key: string, factory: () => Promise<unknown>) => factory()),
    invalidate: vi.fn(),
  };
  service = new PostsService(
    posts as unknown as PostRepository,
    revisionRepo as unknown as RevisionRepository,
    sanitizer as unknown as HtmlSanitizerService,
    hooks as unknown as HookRegistry,
    cache as unknown as CacheService,
  );
});

describe('PostsService.create', () => {
  it('a draft is not stamped published and fires no post.published hook', async () => {
    posts.create.mockResolvedValue(postRow());
    await service.create({ title: 'T', content: '<p>x</p>' }, 'u1');
    const data = posts.create.mock.calls[0]?.[0];
    expect(data.status).toBe('DRAFT');
    expect(data.publishedAt).toBeNull();
    expect(data.content).toBe('clean:<p>x</p>'); // sanitized
    expect(hooks.emit).not.toHaveBeenCalledWith('post.published', expect.anything());
    // content.changed still fires so the cache is invalidated.
    expect(hooks.emit).toHaveBeenCalledWith(
      'content.changed',
      expect.objectContaining({ type: 'post' }),
    );
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
    expect(hooks.emit).not.toHaveBeenCalledWith('post.published', expect.anything());
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

  it('caches the public list read', async () => {
    posts.listAndCount.mockResolvedValue({ items: [], total: 0 });
    await service.list({ page: 1, perPage: 10 } as never, { publicOnly: true });
    expect(cache.getOrSet).toHaveBeenCalled();
  });

  it('does NOT cache the admin list read', async () => {
    posts.listAndCount.mockResolvedValue({ items: [], total: 0 });
    await service.list({ page: 1, perPage: 10 } as never, { publicOnly: false });
    expect(cache.getOrSet).not.toHaveBeenCalled();
  });

  it('emits content.changed after creating a post', async () => {
    posts.create.mockResolvedValue(postRow());
    await service.create({ title: 'T', content: '' }, 'u1');
    expect(hooks.emit).toHaveBeenCalledWith(
      'content.changed',
      expect.objectContaining({ type: 'post', id: 'p1' }),
    );
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

describe('PostsService.restoreRevision', () => {
  it('restores a revision by reusing update with the snapshot fields', async () => {
    revisionRepo.findById.mockResolvedValue({
      id: 'r1',
      postId: 'p1',
      pageId: null,
      authorId: 'u1',
      snapshot: { title: 'Old', slug: 'old', excerpt: null, content: 'oldbody', status: 'DRAFT' },
      createdAt: new Date(),
    });
    posts.findActiveById.mockResolvedValue(postRow());
    posts.update.mockResolvedValue(postRow({ title: 'Old' }));
    const detail = await service.restoreRevision('p1', 'r1', 'editor-1');
    // content is re-sanitized on the shared update path (clean: prefix from the fake).
    expect(posts.update).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({
        title: 'Old',
        slug: 'old',
        content: 'clean:oldbody',
        status: 'DRAFT',
      }),
    );
    // the pre-restore snapshot is attributed to the restoring user.
    expect(revisionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ postId: 'p1', authorId: 'editor-1' }),
    );
    expect(detail.title).toBe('Old');
  });

  it('404s when the revision is missing', async () => {
    revisionRepo.findById.mockResolvedValue(null);
    await expect(service.restoreRevision('p1', 'rX', 'u1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(posts.update).not.toHaveBeenCalled();
  });

  it('404s when the revision belongs to a different post', async () => {
    revisionRepo.findById.mockResolvedValue({ id: 'r1', postId: 'other', snapshot: {} });
    await expect(service.restoreRevision('p1', 'r1', 'u1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(posts.update).not.toHaveBeenCalled();
  });
});

describe('PostsService scheduled publishing', () => {
  it('create stores scheduledAt for a draft', async () => {
    posts.create.mockResolvedValue(postRow());
    await service.create(
      { title: 'T', content: '', scheduledAt: '2026-07-01T09:00:00.000Z' },
      'u1',
    );
    expect(posts.create.mock.calls[0]?.[0].scheduledAt).toEqual(
      new Date('2026-07-01T09:00:00.000Z'),
    );
  });

  it('create clears scheduledAt when publishing immediately', async () => {
    posts.create.mockResolvedValue(postRow({ status: 'PUBLISHED' }));
    await service.create(
      { title: 'T', content: '', status: 'PUBLISHED', scheduledAt: '2026-07-01T09:00:00.000Z' },
      'u1',
    );
    expect(posts.create.mock.calls[0]?.[0].scheduledAt).toBeNull();
  });

  it('publishScheduled publishes a due draft and emits both events', async () => {
    posts.findActiveById.mockResolvedValue(
      postRow({
        status: 'DRAFT',
        publishedAt: null,
        scheduledAt: new Date('2026-06-28T11:00:00Z'),
      }),
    );
    posts.update.mockResolvedValue(postRow({ status: 'PUBLISHED', slug: 'title' }));
    await service.publishScheduled('p1');
    const data = posts.update.mock.calls[0]?.[1];
    expect(data.status).toBe('PUBLISHED');
    expect(data.scheduledAt).toBeNull();
    expect(data.publishedAt).toBeInstanceOf(Date);
    expect(hooks.emit).toHaveBeenCalledWith(
      'post.published',
      expect.objectContaining({ id: 'p1' }),
    );
    expect(hooks.emit).toHaveBeenCalledWith(
      'content.changed',
      expect.objectContaining({ type: 'post' }),
    );
  });

  it('publishScheduled is a no-op when the post is no longer a scheduled draft', async () => {
    posts.findActiveById.mockResolvedValue(postRow({ status: 'PUBLISHED', scheduledAt: null }));
    await service.publishScheduled('p1');
    expect(posts.update).not.toHaveBeenCalled();
  });

  it('publishDue publishes every due id', async () => {
    posts.findDueScheduledIds.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);
    posts.findActiveById.mockResolvedValue(
      postRow({
        status: 'DRAFT',
        publishedAt: null,
        scheduledAt: new Date('2026-06-28T11:00:00Z'),
      }),
    );
    posts.update.mockResolvedValue(postRow({ status: 'PUBLISHED' }));
    const count = await service.publishDue(new Date('2026-06-28T12:00:00Z'));
    expect(count).toBe(2);
    expect(posts.update).toHaveBeenCalledTimes(2);
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

describe('PostsService.findRelated', () => {
  it('returns [] for an unknown slug without querying candidates', async () => {
    posts.findPublicBySlug.mockResolvedValue(null);
    await expect(service.findRelated('missing')).resolves.toEqual([]);
    expect(posts.findRelatedPublic).not.toHaveBeenCalled();
  });

  it('returns [] when the source post has no taxonomy', async () => {
    posts.findPublicBySlug.mockResolvedValue(postRow({ categories: [], tags: [] }));
    await expect(service.findRelated('title')).resolves.toEqual([]);
    expect(posts.findRelatedPublic).not.toHaveBeenCalled();
  });

  it('ranks candidates by shared taxonomy and caps at the limit', async () => {
    const cat = (id: string) =>
      ({ id, name: id, slug: id }) as PostWithRelations['categories'][number];
    posts.findPublicBySlug.mockResolvedValue(
      postRow({ id: 'src', categories: [cat('c1'), cat('c2')], tags: [] }),
    );
    posts.findRelatedPublic.mockResolvedValue([
      postRow({ id: 'a', slug: 'a', categories: [cat('c1')], tags: [] }), // score 1
      postRow({ id: 'b', slug: 'b', categories: [cat('c1'), cat('c2')], tags: [] }), // score 2
    ]);
    const result = await service.findRelated('title', 'en', 1);
    expect(result.map((p) => p.id)).toEqual(['b']); // highest score, limit 1
    // source post is excluded + only its taxonomy ids are passed to the repo.
    const args = posts.findRelatedPublic.mock.calls[0] ?? [];
    expect(args[0]).toBe('src');
    expect(args[1]).toEqual(['c1', 'c2']);
  });
});
