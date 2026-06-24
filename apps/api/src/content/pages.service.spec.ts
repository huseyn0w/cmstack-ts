import type { PageRepository, PageWithAuthor, RevisionRepository } from '@cmstack-ts/db';
import { NotFoundException } from '@nestjs/common';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HtmlSanitizerService } from './html-sanitizer.service';
import { PagesService } from './pages.service';

function pageRow(over: Partial<PageWithAuthor> = {}): PageWithAuthor {
  return {
    id: 'pg1',
    title: 'About',
    slug: 'about',
    content: 'body',
    status: 'DRAFT',
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
let service: PagesService;

beforeEach(() => {
  pages = {
    create: vi.fn(),
    findById: vi.fn(),
    findActiveById: vi.fn(),
    findPublicBySlug: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    setDeletedAt: vi.fn(),
    restore: vi.fn(),
    findIdBySlug: vi.fn().mockResolvedValue(null),
    exists: vi.fn(),
    hardDelete: vi.fn(),
  };
  revisionRepo = { create: vi.fn(), listForPost: vi.fn(), listForPage: vi.fn() };
  sanitizer = { sanitize: vi.fn((s: string) => `clean:${s}`) };
  service = new PagesService(
    pages as unknown as PageRepository,
    revisionRepo as unknown as RevisionRepository,
    sanitizer as unknown as HtmlSanitizerService,
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
});
