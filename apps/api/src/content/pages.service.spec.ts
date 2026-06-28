import type { PageRepository, PageWithAuthor, RevisionRepository } from '@cmstack-ts/db';
import { NotFoundException } from '@nestjs/common';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CacheService } from '../cache/cache.service';
import type { HookRegistry } from '../plugins/hook-registry';
import type { HtmlSanitizerService } from './html-sanitizer.service';
import { PagesService } from './pages.service';

function pageRow(over: Partial<PageWithAuthor> = {}): PageWithAuthor {
  return {
    id: 'pg1',
    title: 'About',
    slug: 'about',
    content: 'body',
    status: 'DRAFT',
    scheduledAt: null,
    metaTitle: null,
    metaDescription: null,
    canonicalUrl: null,
    noindex: false,
    authorId: 'u1',
    deletedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    author: { id: 'u1', name: 'Ada', image: null } as PageWithAuthor['author'],
    ...over,
  } as PageWithAuthor;
}

let pages: Record<keyof PageRepository, Mock>;
let revisionRepo: Record<keyof RevisionRepository, Mock>;
let sanitizer: { sanitize: Mock };
let hooks: { emit: Mock };
let cache: { getOrSet: Mock; invalidate: Mock };
let service: PagesService;

beforeEach(() => {
  pages = {
    create: vi.fn(),
    slugsByIds: vi.fn(),
    findById: vi.fn(),
    findActiveById: vi.fn(),
    findByIdWithTranslations: vi.fn(),
    findPublicBySlug: vi.fn(),
    list: vi.fn(),
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
  hooks = { emit: vi.fn().mockResolvedValue(undefined) };
  cache = {
    getOrSet: vi.fn((_key: string, factory: () => Promise<unknown>) => factory()),
    invalidate: vi.fn(),
  };
  service = new PagesService(
    pages as unknown as PageRepository,
    revisionRepo as unknown as RevisionRepository,
    sanitizer as unknown as HtmlSanitizerService,
    hooks as unknown as HookRegistry,
    cache as unknown as CacheService,
  );
});

describe('PagesService', () => {
  it('create sanitizes content and defaults status to DRAFT', async () => {
    pages.create.mockResolvedValue(pageRow());
    await service.create({ title: 'About', content: '<p>hi</p>' }, 'u1');
    expect(pages.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'DRAFT', content: 'clean:<p>hi</p>' }),
    );
  });

  it('update snapshots before writing and throws NotFound when trashed/absent', async () => {
    pages.findActiveById.mockResolvedValue(null);
    await expect(service.update('x', { title: 'T' }, 'u1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(revisionRepo.create).not.toHaveBeenCalled();

    pages.findActiveById.mockResolvedValue(pageRow());
    pages.update.mockResolvedValue(pageRow());
    await service.update('pg1', { title: 'New' }, 'u9');
    expect(revisionRepo.create).toHaveBeenCalledWith({
      pageId: 'pg1',
      authorId: 'u9',
      snapshot: { title: 'About', slug: 'about', content: 'body', status: 'DRAFT' },
    });
  });

  it('softDelete / restore / destroy gate on existence', async () => {
    pages.exists.mockResolvedValue(true);
    pages.restore.mockResolvedValue(pageRow());
    await service.softDelete('pg1');
    await service.restore('pg1');
    await service.destroy('pg1');
    expect(pages.setDeletedAt).toHaveBeenCalledWith('pg1', expect.any(Date));
    expect(pages.restore).toHaveBeenCalledWith('pg1');
    expect(pages.hardDelete).toHaveBeenCalledWith('pg1');
  });

  it('revisions reads the page history newest-first via the revision repo', async () => {
    pages.exists.mockResolvedValue(true);
    revisionRepo.listForPage.mockResolvedValue([]);
    await service.revisions('pg1');
    expect(revisionRepo.listForPage).toHaveBeenCalledWith('pg1');
  });

  it('create passes metaTitle/metaDescription through', async () => {
    pages.create.mockResolvedValue(pageRow());
    await service.create({ title: 'A', content: '', metaTitle: 'MT', metaDescription: 'MD' }, 'u1');
    expect(pages.create).toHaveBeenCalledWith(
      expect.objectContaining({ metaTitle: 'MT', metaDescription: 'MD' }),
    );
  });

  it('the default locale reads base-only; a non-default locale overlays + falls back', async () => {
    pages.findPublicBySlug.mockResolvedValueOnce(pageRow({ status: 'PUBLISHED' }));
    await service.findPublicBySlug('about', 'en');
    expect(pages.findPublicBySlug).toHaveBeenCalledWith('about', undefined);

    pages.findPublicBySlug.mockResolvedValueOnce({
      ...pageRow({ status: 'PUBLISHED' }),
      translations: [{ locale: 'de', title: 'Über', content: null, metaTitle: null }],
    });
    const detail = await service.findPublicBySlug('about', 'de');
    expect(pages.findPublicBySlug).toHaveBeenLastCalledWith('about', 'de');
    expect(detail.title).toBe('Über'); // overlaid
    expect(detail.content).toBe('body'); // fallback
  });

  it('caches the public page read and emits content.changed on create', async () => {
    pages.findPublicBySlug.mockResolvedValue(pageRow({ status: 'PUBLISHED' }));
    await service.findPublicBySlug('about', 'en');
    expect(cache.getOrSet).toHaveBeenCalled();

    pages.create.mockResolvedValue(pageRow());
    await service.create({ title: 'A', content: '' }, 'u1');
    expect(hooks.emit).toHaveBeenCalledWith(
      'content.changed',
      expect.objectContaining({ type: 'page', id: 'pg1' }),
    );
  });

  it('findById returns the page with its translation rows', async () => {
    pages.findByIdWithTranslations.mockResolvedValue({
      ...pageRow(),
      translations: [
        { locale: 'ru', title: 'O nas', content: 'c', metaTitle: null, metaDescription: null },
      ],
    });
    const detail = await service.findById('pg1');
    expect(detail.translations).toEqual([
      { locale: 'ru', title: 'O nas', content: 'c', metaTitle: null, metaDescription: null },
    ]);
  });

  it('upsertTranslation sanitizes content; an all-empty save clears it', async () => {
    pages.findActiveById.mockResolvedValue(pageRow());
    await service.upsertTranslation('pg1', 'de', { title: 'DE', content: '<b>x</b>' });
    expect(pages.upsertTranslation).toHaveBeenCalledWith('pg1', 'de', {
      title: 'DE',
      content: 'clean:<b>x</b>',
    });

    await service.upsertTranslation('pg1', 'de', {});
    expect(pages.deleteTranslation).toHaveBeenCalledWith('pg1', 'de');
  });

  it('upsertTranslation throws NotFound when the base page is missing/trashed', async () => {
    pages.findActiveById.mockResolvedValue(null);
    await expect(service.upsertTranslation('x', 'de', { title: 'T' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(pages.upsertTranslation).not.toHaveBeenCalled();
  });

  it('restoreRevision restores a page revision via update', async () => {
    revisionRepo.findById.mockResolvedValue({
      id: 'r1',
      postId: null,
      pageId: 'pg1',
      authorId: 'u1',
      snapshot: { title: 'Old', slug: 'old', content: 'b', status: 'DRAFT' },
      createdAt: new Date(),
    });
    pages.findActiveById.mockResolvedValue(pageRow());
    pages.update.mockResolvedValue(pageRow({ title: 'Old' }));
    const detail = await service.restoreRevision('pg1', 'r1', 'editor-1');
    // content is re-sanitized on the shared update path (clean: prefix from the fake).
    expect(pages.update).toHaveBeenCalledWith(
      'pg1',
      expect.objectContaining({ title: 'Old', slug: 'old', content: 'clean:b', status: 'DRAFT' }),
    );
    expect(revisionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ pageId: 'pg1', authorId: 'editor-1' }),
    );
    expect(detail.title).toBe('Old');
  });

  it('restoreRevision 404s when the revision belongs to another page', async () => {
    revisionRepo.findById.mockResolvedValue({ id: 'r1', pageId: 'other', snapshot: {} });
    await expect(service.restoreRevision('pg1', 'r1', 'u1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(pages.update).not.toHaveBeenCalled();
  });

  it('create stores scheduledAt for a draft', async () => {
    pages.create.mockResolvedValue(pageRow());
    await service.create(
      { title: 'A', content: '', scheduledAt: '2026-07-01T09:00:00.000Z' },
      'u1',
    );
    expect(pages.create.mock.calls[0]?.[0].scheduledAt).toEqual(
      new Date('2026-07-01T09:00:00.000Z'),
    );
  });

  it('publishScheduled publishes a due draft and emits content.changed', async () => {
    pages.findActiveById.mockResolvedValue(
      pageRow({ status: 'DRAFT', scheduledAt: new Date('2026-06-28T11:00:00Z') }),
    );
    pages.update.mockResolvedValue(pageRow({ status: 'PUBLISHED' }));
    await service.publishScheduled('pg1');
    const data = pages.update.mock.calls[0]?.[1];
    expect(data.status).toBe('PUBLISHED');
    expect(data.scheduledAt).toBeNull();
    expect(hooks.emit).toHaveBeenCalledWith(
      'content.changed',
      expect.objectContaining({ type: 'page' }),
    );
  });

  it('publishScheduled is a no-op for a non-scheduled page', async () => {
    pages.findActiveById.mockResolvedValue(pageRow({ status: 'PUBLISHED', scheduledAt: null }));
    await service.publishScheduled('pg1');
    expect(pages.update).not.toHaveBeenCalled();
  });

  it('publishDue publishes every due page id', async () => {
    pages.findDueScheduledIds.mockResolvedValue([{ id: 'pg1' }, { id: 'pg2' }]);
    pages.findActiveById.mockResolvedValue(
      pageRow({ status: 'DRAFT', scheduledAt: new Date('2026-06-28T11:00:00Z') }),
    );
    pages.update.mockResolvedValue(pageRow({ status: 'PUBLISHED' }));
    expect(await service.publishDue(new Date('2026-06-28T12:00:00Z'))).toBe(2);
    expect(pages.update).toHaveBeenCalledTimes(2);
  });
});
