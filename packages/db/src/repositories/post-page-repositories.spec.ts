import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PrismaPageRepository } from './page.repository';
import { PrismaPostRepository } from './post.repository';
import { PrismaRevisionRepository } from './revision.repository';

function postRepo() {
  const post = {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  };
  const postTranslation = { upsert: vi.fn(), delete: vi.fn() };
  const $transaction = vi.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]));
  const prisma = { post, postTranslation, $transaction } as unknown as PrismaClient;
  return { repo: new PrismaPostRepository(prisma), post, postTranslation, $transaction };
}

describe('PrismaPostRepository.create', () => {
  it('CONNECTs categories/tags on create (additive)', async () => {
    const { repo, post } = postRepo();
    post.create.mockResolvedValue({});
    await repo.create({
      title: 'T',
      slug: 't',
      excerpt: null,
      content: 'c',
      status: 'DRAFT',
      publishedAt: null,
      authorId: 'u1',
      categoryIds: ['c1', 'c2'],
      tagIds: ['t1'],
    });
    const data = post.create.mock.calls[0]?.[0]?.data;
    expect(data.categories).toEqual({ connect: [{ id: 'c1' }, { id: 'c2' }] });
    expect(data.tags).toEqual({ connect: [{ id: 't1' }] });
  });

  it('omits relations entirely when no ids are given', async () => {
    const { repo, post } = postRepo();
    post.create.mockResolvedValue({});
    await repo.create({
      title: 'T',
      slug: 't',
      excerpt: null,
      content: 'c',
      status: 'DRAFT',
      publishedAt: null,
      authorId: 'u1',
    });
    const data = post.create.mock.calls[0]?.[0]?.data;
    expect(data.categories).toBeUndefined();
    expect(data.tags).toBeUndefined();
  });
});

describe('PrismaPostRepository.update', () => {
  it('SETs categories/tags on update (replace, not connect)', async () => {
    const { repo, post } = postRepo();
    post.update.mockResolvedValue({});
    await repo.update('p1', { categoryIds: ['c9'], tagIds: [] });
    const data = post.update.mock.calls[0]?.[0]?.data;
    expect(data.categories).toEqual({ set: [{ id: 'c9' }] });
    expect(data.tags).toEqual({ set: [] }); // empty array clears tags
  });

  it('only writes the provided fields', async () => {
    const { repo, post } = postRepo();
    post.update.mockResolvedValue({});
    await repo.update('p1', { title: 'New' });
    expect(post.update.mock.calls[0]?.[0]?.data).toEqual({ title: 'New' });
  });
});

describe('PrismaPostRepository.listAndCount', () => {
  it('publicOnly forces PUBLISHED + non-trashed', async () => {
    const { repo, post } = postRepo();
    post.findMany.mockResolvedValue([]);
    post.count.mockResolvedValue(0);
    await repo.listAndCount({ publicOnly: true, page: 1, perPage: 10 });
    expect(post.count.mock.calls[0]?.[0]?.where).toEqual({ status: 'PUBLISHED', deletedAt: null });
  });

  it('admin view hides trashed by default and applies taxonomy/q filters', async () => {
    const { repo, post } = postRepo();
    post.findMany.mockResolvedValue([]);
    post.count.mockResolvedValue(0);
    await repo.listAndCount({
      publicOnly: false,
      status: 'DRAFT',
      categorySlug: 'news',
      tagSlug: 'js',
      q: 'hello',
      page: 2,
      perPage: 5,
    });
    expect(post.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: {
        deletedAt: null,
        status: 'DRAFT',
        categories: { some: { slug: 'news' } },
        tags: { some: { slug: 'js' } },
        title: { contains: 'hello', mode: 'insensitive' },
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      skip: 5,
      take: 5,
    });
  });

  it('admin view with includeTrashed drops the deletedAt filter', async () => {
    const { repo, post } = postRepo();
    post.findMany.mockResolvedValue([]);
    post.count.mockResolvedValue(0);
    await repo.listAndCount({ publicOnly: false, includeTrashed: true, page: 1, perPage: 10 });
    expect(post.count.mock.calls[0]?.[0]?.where).toEqual({});
  });
});

describe('PrismaPostRepository localization', () => {
  it('findPublicBySlug without a locale includes no translations (en path unchanged)', async () => {
    const { repo, post } = postRepo();
    post.findFirst.mockResolvedValue(null);
    await repo.findPublicBySlug('s');
    const include = post.findFirst.mock.calls[0]?.[0]?.include;
    expect(include).toEqual({ author: true, categories: true, tags: true });
  });

  it("findPublicBySlug with a locale includes that locale's translations only", async () => {
    const { repo, post } = postRepo();
    post.findFirst.mockResolvedValue(null);
    await repo.findPublicBySlug('s', 'de');
    const include = post.findFirst.mock.calls[0]?.[0]?.include;
    expect(include.translations).toEqual({ where: { locale: 'de' } });
  });

  it("listAndCount with a locale joins that locale's translations", async () => {
    const { repo, post } = postRepo();
    post.findMany.mockResolvedValue([]);
    post.count.mockResolvedValue(0);
    await repo.listAndCount({ publicOnly: true, page: 1, perPage: 10 }, 'ru');
    expect(post.findMany.mock.calls[0]?.[0]?.include.translations).toEqual({
      where: { locale: 'ru' },
    });
  });

  it("publicByAuthor with a locale joins that locale's translations", async () => {
    const { repo, post } = postRepo();
    post.findMany.mockResolvedValue([]);
    await repo.publicByAuthor('u1', 'de');
    expect(post.findMany.mock.calls[0]?.[0]?.include.translations).toEqual({
      where: { locale: 'de' },
    });
  });

  it('slugsByIds selects id+slug for the given ids and returns an id→slug map', async () => {
    const { repo, post } = postRepo();
    post.findMany.mockResolvedValue([
      { id: 'a', slug: 'alpha' },
      { id: 'b', slug: 'beta' },
    ]);
    const map = await repo.slugsByIds(['a', 'b']);
    expect(post.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['a', 'b'] } },
      select: { id: true, slug: true },
    });
    expect(map).toEqual({ a: 'alpha', b: 'beta' });
  });

  it('slugsByIds short-circuits on an empty id list (no query)', async () => {
    const { repo, post } = postRepo();
    const map = await repo.slugsByIds([]);
    expect(post.findMany).not.toHaveBeenCalled();
    expect(map).toEqual({});
  });

  it('findByIdWithTranslations includes ALL translations (admin edit)', async () => {
    const { repo, post } = postRepo();
    post.findUnique.mockResolvedValue(null);
    await repo.findByIdWithTranslations('p1');
    const include = post.findUnique.mock.calls[0]?.[0]?.include;
    expect(include.translations).toBe(true);
  });

  it('upsertTranslation writes the full locale row on the composite key', async () => {
    const { repo, postTranslation } = postRepo();
    postTranslation.upsert.mockResolvedValue({});
    await repo.upsertTranslation('p1', 'de', { title: 'T', content: 'c' });
    const arg = postTranslation.upsert.mock.calls[0]?.[0];
    expect(arg.where).toEqual({ postId_locale: { postId: 'p1', locale: 'de' } });
    expect(arg.create).toEqual({
      postId: 'p1',
      locale: 'de',
      title: 'T',
      excerpt: null,
      content: 'c',
      metaTitle: null,
      metaDescription: null,
    });
    expect(arg.update).toEqual({
      title: 'T',
      excerpt: null,
      content: 'c',
      metaTitle: null,
      metaDescription: null,
    });
  });

  it('deleteTranslation removes by the composite key', async () => {
    const { repo, postTranslation } = postRepo();
    postTranslation.delete.mockResolvedValue({});
    await repo.deleteTranslation('p1', 'ru');
    expect(postTranslation.delete.mock.calls[0]?.[0]?.where).toEqual({
      postId_locale: { postId: 'p1', locale: 'ru' },
    });
  });
});

describe('PrismaPageRepository', () => {
  function pageRepo() {
    const page = {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    };
    const pageTranslation = { upsert: vi.fn(), delete: vi.fn() };
    const prisma = { page, pageTranslation } as unknown as PrismaClient;
    return { repo: new PrismaPageRepository(prisma), page, pageTranslation };
  }

  it('list() orders by updatedAt desc and hides trashed by default', async () => {
    const { repo, page } = pageRepo();
    page.findMany.mockResolvedValue([]);
    await repo.list({});
    expect(page.findMany).toHaveBeenCalledWith({
      where: { deletedAt: null },
      include: { author: true },
      orderBy: { updatedAt: 'desc' },
    });
  });

  it('findActiveById() scopes to non-trashed', async () => {
    const { repo, page } = pageRepo();
    page.findFirst.mockResolvedValue(null);
    await repo.findActiveById('p1');
    expect(page.findFirst).toHaveBeenCalledWith({
      where: { id: 'p1', deletedAt: null },
      include: { author: true },
    });
  });

  it('findPublicBySlug without a locale includes no translations (en path unchanged)', async () => {
    const { repo, page } = pageRepo();
    page.findFirst.mockResolvedValue(null);
    await repo.findPublicBySlug('s');
    expect(page.findFirst.mock.calls[0]?.[0]?.include).toEqual({ author: true });
  });

  it("findPublicBySlug with a locale joins that locale's translation", async () => {
    const { repo, page } = pageRepo();
    page.findFirst.mockResolvedValue(null);
    await repo.findPublicBySlug('s', 'de');
    expect(page.findFirst.mock.calls[0]?.[0]?.include.translations).toEqual({
      where: { locale: 'de' },
    });
  });

  it('findByIdWithTranslations includes ALL translations', async () => {
    const { repo, page } = pageRepo();
    page.findUnique.mockResolvedValue(null);
    await repo.findByIdWithTranslations('p1');
    expect(page.findUnique.mock.calls[0]?.[0]?.include.translations).toBe(true);
  });

  it('upsertTranslation writes the full locale row on the composite key (no excerpt)', async () => {
    const { repo, pageTranslation } = pageRepo();
    pageTranslation.upsert.mockResolvedValue({});
    await repo.upsertTranslation('p1', 'ru', { title: 'T', content: 'c' });
    const arg = pageTranslation.upsert.mock.calls[0]?.[0];
    expect(arg.where).toEqual({ pageId_locale: { pageId: 'p1', locale: 'ru' } });
    expect(arg.create).toEqual({
      pageId: 'p1',
      locale: 'ru',
      title: 'T',
      content: 'c',
      metaTitle: null,
      metaDescription: null,
    });
    expect(arg.update).toEqual({
      title: 'T',
      content: 'c',
      metaTitle: null,
      metaDescription: null,
    });
  });

  it('deleteTranslation removes by the composite key', async () => {
    const { repo, pageTranslation } = pageRepo();
    pageTranslation.delete.mockResolvedValue({});
    await repo.deleteTranslation('p1', 'de');
    expect(pageTranslation.delete.mock.calls[0]?.[0]?.where).toEqual({
      pageId_locale: { pageId: 'p1', locale: 'de' },
    });
  });
});

describe('PrismaRevisionRepository', () => {
  function make() {
    const revision = { create: vi.fn(), findMany: vi.fn() };
    const prisma = { revision } as unknown as PrismaClient;
    return { repo: new PrismaRevisionRepository(prisma), revision };
  }

  it('create() forwards the snapshot payload', async () => {
    const { repo, revision } = make();
    revision.create.mockResolvedValue({});
    await repo.create({ postId: 'p1', authorId: 'u1', snapshot: { title: 'x' } });
    expect(revision.create).toHaveBeenCalledWith({
      data: { postId: 'p1', authorId: 'u1', snapshot: { title: 'x' } },
    });
  });

  it('listForPost/listForPage order newest first', async () => {
    const { repo, revision } = make();
    revision.findMany.mockResolvedValue([]);
    await repo.listForPost('p1');
    await repo.listForPage('pg1');
    expect(revision.findMany).toHaveBeenNthCalledWith(1, {
      where: { postId: 'p1' },
      orderBy: { createdAt: 'desc' },
    });
    expect(revision.findMany).toHaveBeenNthCalledWith(2, {
      where: { pageId: 'pg1' },
      orderBy: { createdAt: 'desc' },
    });
  });
});
