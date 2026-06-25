import { type ContentStatus, Prisma, type PrismaClient } from '@prisma/client';
import { PrismaCrudRepository } from './crud.repository';

export const pageInclude = { author: true } satisfies Prisma.PageInclude;

export type PageWithAuthor = Prisma.PageGetPayload<{ include: typeof pageInclude }>;

/** See {@link import('./post.repository').localizedPostInclude}. */
export function localizedPageInclude(locale?: string): Prisma.PageInclude {
  return locale ? { ...pageInclude, translations: { where: { locale } } } : pageInclude;
}

export type PageTranslationRow = Prisma.PageTranslationGetPayload<Record<string, never>>;

export type LocalizedPage = PageWithAuthor & { translations?: PageTranslationRow[] };

/** The per-locale fields a page translation write defines (no excerpt). */
export type PageTranslationData = {
  title?: string;
  content?: string;
  metaTitle?: string;
  metaDescription?: string;
};

export type PageCreateData = {
  title: string;
  slug: string;
  content: string;
  status: ContentStatus;
  metaTitle?: string | null;
  metaDescription?: string | null;
  canonicalUrl?: string | null;
  noindex?: boolean;
  authorId: string;
};

export type PageUpdateData = {
  title?: string;
  slug?: string;
  content?: string;
  status?: ContentStatus;
  metaTitle?: string | null;
  metaDescription?: string | null;
  canonicalUrl?: string | null;
  noindex?: boolean;
};

/** Data access for {@link Page}. */
export interface PageRepository {
  create(data: PageCreateData): Promise<PageWithAuthor>;
  findById(id: string): Promise<PageWithAuthor | null>;
  /** Non-trashed page by id (deletedAt: null) — the editable view. */
  findActiveById(id: string): Promise<PageWithAuthor | null>;
  /** A page with every translation row — the admin edit view. */
  findByIdWithTranslations(id: string): Promise<LocalizedPage | null>;
  /** Published, non-trashed page by slug; overlays `locale`'s translation when given. */
  findPublicBySlug(slug: string, locale?: string): Promise<LocalizedPage | null>;
  list(opts: { includeTrashed?: boolean }): Promise<PageWithAuthor[]>;
  update(id: string, data: PageUpdateData): Promise<PageWithAuthor>;
  setDeletedAt(id: string, when: Date | null): Promise<void>;
  restore(id: string): Promise<PageWithAuthor>;
  findIdBySlug(slug: string): Promise<{ id: string } | null>;
  /** Map of id → slug for the given ids (menu item URL resolution; no N+1). */
  slugsByIds(ids: string[]): Promise<Record<string, string>>;
  /** Create or replace the page's translation for `locale` (full-row replace). */
  upsertTranslation(pageId: string, locale: string, data: PageTranslationData): Promise<void>;
  deleteTranslation(pageId: string, locale: string): Promise<void>;
  exists(id: string): Promise<boolean>;
  hardDelete(id: string): Promise<void>;
}

export const PAGE_REPOSITORY = Symbol('PAGE_REPOSITORY');

export class PrismaPageRepository extends PrismaCrudRepository implements PageRepository {
  constructor(private readonly prisma: PrismaClient) {
    super(prisma.page);
  }

  create(data: PageCreateData): Promise<PageWithAuthor> {
    return this.prisma.page.create({ data, include: pageInclude });
  }

  findById(id: string): Promise<PageWithAuthor | null> {
    return this.prisma.page.findUnique({ where: { id }, include: pageInclude });
  }

  findActiveById(id: string): Promise<PageWithAuthor | null> {
    return this.prisma.page.findFirst({ where: { id, deletedAt: null }, include: pageInclude });
  }

  async slugsByIds(ids: string[]): Promise<Record<string, string>> {
    if (ids.length === 0) return {};
    const rows = await this.prisma.page.findMany({
      where: { id: { in: ids } },
      select: { id: true, slug: true },
    });
    return Object.fromEntries(rows.map((r) => [r.id, r.slug]));
  }

  findByIdWithTranslations(id: string): Promise<LocalizedPage | null> {
    return this.prisma.page.findUnique({
      where: { id },
      include: { ...pageInclude, translations: true },
    });
  }

  findPublicBySlug(slug: string, locale?: string): Promise<LocalizedPage | null> {
    return this.prisma.page.findFirst({
      where: { slug, status: 'PUBLISHED', deletedAt: null },
      include: localizedPageInclude(locale),
    });
  }

  list(opts: { includeTrashed?: boolean }): Promise<PageWithAuthor[]> {
    return this.prisma.page.findMany({
      where: opts.includeTrashed ? {} : { deletedAt: null },
      include: pageInclude,
      orderBy: { updatedAt: 'desc' },
    });
  }

  update(id: string, data: PageUpdateData): Promise<PageWithAuthor> {
    const prismaData: Prisma.PageUpdateInput = {};
    if (data.title !== undefined) prismaData.title = data.title;
    if (data.slug !== undefined) prismaData.slug = data.slug;
    if (data.content !== undefined) prismaData.content = data.content;
    if (data.status !== undefined) prismaData.status = data.status;
    if (data.metaTitle !== undefined) prismaData.metaTitle = data.metaTitle;
    if (data.metaDescription !== undefined) prismaData.metaDescription = data.metaDescription;
    if (data.canonicalUrl !== undefined) prismaData.canonicalUrl = data.canonicalUrl;
    if (data.noindex !== undefined) prismaData.noindex = data.noindex;
    return this.prisma.page.update({ where: { id }, data: prismaData, include: pageInclude });
  }

  async setDeletedAt(id: string, when: Date | null): Promise<void> {
    await this.prisma.page.update({ where: { id }, data: { deletedAt: when } });
  }

  restore(id: string): Promise<PageWithAuthor> {
    return this.prisma.page.update({
      where: { id },
      data: { deletedAt: null },
      include: pageInclude,
    });
  }

  findIdBySlug(slug: string): Promise<{ id: string } | null> {
    return this.prisma.page.findUnique({ where: { slug }, select: { id: true } });
  }

  async upsertTranslation(
    pageId: string,
    locale: string,
    data: PageTranslationData,
  ): Promise<void> {
    const fields = {
      title: data.title ?? null,
      content: data.content ?? null,
      metaTitle: data.metaTitle ?? null,
      metaDescription: data.metaDescription ?? null,
    };
    await this.prisma.pageTranslation.upsert({
      where: { pageId_locale: { pageId, locale } },
      create: { pageId, locale, ...fields },
      update: fields,
    });
  }

  async deleteTranslation(pageId: string, locale: string): Promise<void> {
    await this.prisma.pageTranslation.delete({ where: { pageId_locale: { pageId, locale } } });
  }
}
