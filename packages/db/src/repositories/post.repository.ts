import { type ContentStatus, Prisma, type PrismaClient } from '@prisma/client';
import { PrismaCrudRepository } from './crud.repository';

export const postInclude = {
  author: true,
  categories: true,
  tags: true,
} satisfies Prisma.PostInclude;

export type PostWithRelations = Prisma.PostGetPayload<{ include: typeof postInclude }>;

export type PostCreateData = {
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  status: ContentStatus;
  publishedAt: Date | null;
  authorId: string;
  categoryIds?: string[];
  tagIds?: string[];
};

export type PostUpdateData = {
  title?: string;
  slug?: string;
  excerpt?: string | null;
  content?: string;
  status?: ContentStatus;
  /** Set only when the service stamps the first-publish date. */
  publishedAt?: Date;
  /** When present, REPLACES the post's categories (set semantics). */
  categoryIds?: string[];
  /** When present, REPLACES the post's tags (set semantics). */
  tagIds?: string[];
};

export type PostListFilter = {
  publicOnly: boolean;
  includeTrashed?: boolean;
  status?: ContentStatus;
  categorySlug?: string;
  tagSlug?: string;
  q?: string;
  page: number;
  perPage: number;
};

/** Data access for {@link Post} and its category/tag relations. */
export interface PostRepository {
  /** Id of a PUBLISHED, non-trashed post by slug, or null (shared with Likes/Comments). */
  findPublishedIdBySlug(slug: string): Promise<string | null>;
  create(data: PostCreateData): Promise<PostWithRelations>;
  findById(id: string): Promise<PostWithRelations | null>;
  /** Non-trashed post by id (deletedAt: null) — the editable view. */
  findActiveById(id: string): Promise<PostWithRelations | null>;
  findPublicBySlug(slug: string): Promise<PostWithRelations | null>;
  publicByAuthor(authorId: string): Promise<PostWithRelations[]>;
  listAndCount(filter: PostListFilter): Promise<{ items: PostWithRelations[]; total: number }>;
  update(id: string, data: PostUpdateData): Promise<PostWithRelations>;
  setDeletedAt(id: string, when: Date | null): Promise<void>;
  restore(id: string): Promise<PostWithRelations>;
  findIdBySlug(slug: string): Promise<{ id: string } | null>;
  exists(id: string): Promise<boolean>;
  hardDelete(id: string): Promise<void>;
}

export const POST_REPOSITORY = Symbol('POST_REPOSITORY');

export class PrismaPostRepository extends PrismaCrudRepository implements PostRepository {
  constructor(private readonly prisma: PrismaClient) {
    super(prisma.post);
  }

  async findPublishedIdBySlug(slug: string): Promise<string | null> {
    const post = await this.prisma.post.findFirst({
      where: { slug, status: 'PUBLISHED', deletedAt: null },
      select: { id: true },
    });
    return post?.id ?? null;
  }

  create(data: PostCreateData): Promise<PostWithRelations> {
    return this.prisma.post.create({
      data: {
        title: data.title,
        slug: data.slug,
        excerpt: data.excerpt,
        content: data.content,
        status: data.status,
        publishedAt: data.publishedAt,
        authorId: data.authorId,
        categories: data.categoryIds
          ? { connect: data.categoryIds.map((id) => ({ id })) }
          : undefined,
        tags: data.tagIds ? { connect: data.tagIds.map((id) => ({ id })) } : undefined,
      },
      include: postInclude,
    });
  }

  findById(id: string): Promise<PostWithRelations | null> {
    return this.prisma.post.findUnique({ where: { id }, include: postInclude });
  }

  findActiveById(id: string): Promise<PostWithRelations | null> {
    return this.prisma.post.findFirst({ where: { id, deletedAt: null }, include: postInclude });
  }

  findPublicBySlug(slug: string): Promise<PostWithRelations | null> {
    return this.prisma.post.findFirst({
      where: { slug, status: 'PUBLISHED', deletedAt: null },
      include: postInclude,
    });
  }

  publicByAuthor(authorId: string): Promise<PostWithRelations[]> {
    return this.prisma.post.findMany({
      where: { authorId, status: 'PUBLISHED', deletedAt: null },
      include: postInclude,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async listAndCount(filter: PostListFilter): Promise<{
    items: PostWithRelations[];
    total: number;
  }> {
    const where: Prisma.PostWhereInput = {};
    if (filter.publicOnly) {
      where.status = 'PUBLISHED';
      where.deletedAt = null;
    } else {
      if (!filter.includeTrashed) where.deletedAt = null;
      if (filter.status) where.status = filter.status;
    }
    if (filter.categorySlug) where.categories = { some: { slug: filter.categorySlug } };
    if (filter.tagSlug) where.tags = { some: { slug: filter.tagSlug } };
    if (filter.q) where.title = { contains: filter.q, mode: 'insensitive' };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where,
        include: postInclude,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (filter.page - 1) * filter.perPage,
        take: filter.perPage,
      }),
      this.prisma.post.count({ where }),
    ]);
    return { items, total };
  }

  update(id: string, data: PostUpdateData): Promise<PostWithRelations> {
    const prismaData: Prisma.PostUpdateInput = {};
    if (data.title !== undefined) prismaData.title = data.title;
    if (data.slug !== undefined) prismaData.slug = data.slug;
    if (data.excerpt !== undefined) prismaData.excerpt = data.excerpt;
    if (data.content !== undefined) prismaData.content = data.content;
    if (data.status !== undefined) prismaData.status = data.status;
    if (data.publishedAt !== undefined) prismaData.publishedAt = data.publishedAt;
    // `set` REPLACES the relation (vs `connect` on create) — preserves removal-on-edit.
    if (data.categoryIds !== undefined) {
      prismaData.categories = { set: data.categoryIds.map((cid) => ({ id: cid })) };
    }
    if (data.tagIds !== undefined) {
      prismaData.tags = { set: data.tagIds.map((tid) => ({ id: tid })) };
    }
    return this.prisma.post.update({ where: { id }, data: prismaData, include: postInclude });
  }

  async setDeletedAt(id: string, when: Date | null): Promise<void> {
    await this.prisma.post.update({ where: { id }, data: { deletedAt: when } });
  }

  restore(id: string): Promise<PostWithRelations> {
    return this.prisma.post.update({
      where: { id },
      data: { deletedAt: null },
      include: postInclude,
    });
  }

  findIdBySlug(slug: string): Promise<{ id: string } | null> {
    return this.prisma.post.findUnique({ where: { slug }, select: { id: true } });
  }
}
