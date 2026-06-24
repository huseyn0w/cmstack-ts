import { type ContentStatus, Prisma, type PrismaClient } from '@prisma/client';
import { PrismaCrudRepository } from './crud.repository';

export const pageInclude = { author: true } satisfies Prisma.PageInclude;

export type PageWithAuthor = Prisma.PageGetPayload<{ include: typeof pageInclude }>;

export type PageCreateData = {
  title: string;
  slug: string;
  content: string;
  status: ContentStatus;
  authorId: string;
};

export type PageUpdateData = {
  title?: string;
  slug?: string;
  content?: string;
  status?: ContentStatus;
};

/** Data access for {@link Page}. */
export interface PageRepository {
  create(data: PageCreateData): Promise<PageWithAuthor>;
  findById(id: string): Promise<PageWithAuthor | null>;
  /** Non-trashed page by id (deletedAt: null) — the editable view. */
  findActiveById(id: string): Promise<PageWithAuthor | null>;
  findPublicBySlug(slug: string): Promise<PageWithAuthor | null>;
  list(opts: { includeTrashed?: boolean }): Promise<PageWithAuthor[]>;
  update(id: string, data: PageUpdateData): Promise<PageWithAuthor>;
  setDeletedAt(id: string, when: Date | null): Promise<void>;
  restore(id: string): Promise<PageWithAuthor>;
  findIdBySlug(slug: string): Promise<{ id: string } | null>;
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

  findPublicBySlug(slug: string): Promise<PageWithAuthor | null> {
    return this.prisma.page.findFirst({
      where: { slug, status: 'PUBLISHED', deletedAt: null },
      include: pageInclude,
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
}
