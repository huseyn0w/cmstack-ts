import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreatePostInput,
  PostDetail,
  PostList,
  PostListQuery,
  PostSummary,
  UpdatePostInput,
} from '@typress/config';
import { Prisma, type PrismaClient } from '@typress/db';
import { PRISMA } from '../prisma/prisma.module';
import { HtmlSanitizerService } from './html-sanitizer.service';
import { slugify } from './slug';

const postInclude = {
  author: true,
  categories: true,
  tags: true,
} satisfies Prisma.PostInclude;

type PostWithRelations = Prisma.PostGetPayload<{ include: typeof postInclude }>;

export interface RevisionView {
  id: string;
  authorId: string | null;
  snapshot: unknown;
  createdAt: string;
}

@Injectable()
export class PostsService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    private readonly sanitizer: HtmlSanitizerService,
  ) {}

  async create(input: CreatePostInput, authorId: string): Promise<PostDetail> {
    const slug = await this.uniqueSlug(input.slug ?? slugify(input.title));
    const status = input.status ?? 'DRAFT';
    try {
      const post = await this.prisma.post.create({
        data: {
          title: input.title,
          slug,
          excerpt: input.excerpt ?? null,
          content: this.sanitizer.sanitize(input.content ?? ''),
          status,
          publishedAt: status === 'PUBLISHED' ? new Date() : null,
          authorId,
          categories: input.categoryIds
            ? { connect: input.categoryIds.map((id) => ({ id })) }
            : undefined,
          tags: input.tagIds ? { connect: input.tagIds.map((id) => ({ id })) } : undefined,
        },
        include: postInclude,
      });
      return this.toDetail(post);
    } catch (error) {
      throw this.mapRelationError(error);
    }
  }

  async update(id: string, input: UpdatePostInput, authorId: string): Promise<PostDetail> {
    const existing = await this.prisma.post.findFirst({
      where: { id, deletedAt: null },
      include: postInclude,
    });
    if (!existing) {
      throw new NotFoundException('Post not found.');
    }

    // Snapshot the current version before mutating, for revision history.
    await this.prisma.revision.create({
      data: { postId: id, authorId, snapshot: this.snapshot(existing) },
    });

    const data: Prisma.PostUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.slug !== undefined) data.slug = await this.uniqueSlug(input.slug, id);
    if (input.excerpt !== undefined) data.excerpt = input.excerpt ?? null;
    if (input.content !== undefined) data.content = this.sanitizer.sanitize(input.content);
    if (input.status !== undefined) {
      data.status = input.status;
      // Stamp publishedAt on first publish; once set it is preserved (the
      // original publication date) across unpublish/republish cycles.
      if (input.status === 'PUBLISHED' && existing.publishedAt === null) {
        data.publishedAt = new Date();
      }
    }
    if (input.categoryIds !== undefined) {
      data.categories = { set: input.categoryIds.map((cid) => ({ id: cid })) };
    }
    if (input.tagIds !== undefined) {
      data.tags = { set: input.tagIds.map((tid) => ({ id: tid })) };
    }

    try {
      const post = await this.prisma.post.update({ where: { id }, data, include: postInclude });
      return this.toDetail(post);
    } catch (error) {
      throw this.mapRelationError(error);
    }
  }

  async list(query: PostListQuery, opts: { publicOnly: boolean }): Promise<PostList> {
    const where: Prisma.PostWhereInput = {};
    if (opts.publicOnly) {
      where.status = 'PUBLISHED';
      where.deletedAt = null;
    } else {
      if (!query.includeTrashed) where.deletedAt = null;
      if (query.status) where.status = query.status;
    }
    if (query.categorySlug) where.categories = { some: { slug: query.categorySlug } };
    if (query.tagSlug) where.tags = { some: { slug: query.tagSlug } };
    if (query.q) where.title = { contains: query.q, mode: 'insensitive' };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where,
        include: postInclude,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      this.prisma.post.count({ where }),
    ]);

    return {
      items: items.map((p) => this.toSummary(p)),
      total,
      page: query.page,
      perPage: query.perPage,
    };
  }

  async findById(id: string): Promise<PostDetail> {
    const post = await this.prisma.post.findUnique({ where: { id }, include: postInclude });
    if (!post) throw new NotFoundException('Post not found.');
    return this.toDetail(post);
  }

  async findPublicBySlug(slug: string): Promise<PostDetail> {
    const post = await this.prisma.post.findFirst({
      where: { slug, status: 'PUBLISHED', deletedAt: null },
      include: postInclude,
    });
    if (!post) throw new NotFoundException('Post not found.');
    return this.toDetail(post);
  }

  async softDelete(id: string): Promise<void> {
    await this.ensureExists(id);
    await this.prisma.post.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async restore(id: string): Promise<PostDetail> {
    await this.ensureExists(id);
    const post = await this.prisma.post.update({
      where: { id },
      data: { deletedAt: null },
      include: postInclude,
    });
    return this.toDetail(post);
  }

  async destroy(id: string): Promise<void> {
    await this.ensureExists(id);
    await this.prisma.post.delete({ where: { id } });
  }

  async revisions(postId: string): Promise<RevisionView[]> {
    await this.ensureExists(postId);
    const revisions = await this.prisma.revision.findMany({
      where: { postId },
      orderBy: { createdAt: 'desc' },
    });
    return revisions.map((r) => ({
      id: r.id,
      authorId: r.authorId,
      snapshot: r.snapshot,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  private async ensureExists(id: string): Promise<void> {
    const post = await this.prisma.post.findUnique({ where: { id }, select: { id: true } });
    if (!post) throw new NotFoundException('Post not found.');
  }

  private async uniqueSlug(desired: string, excludeId?: string): Promise<string> {
    let candidate = desired;
    let suffix = 1;
    while (true) {
      const existing = await this.prisma.post.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!existing || existing.id === excludeId) return candidate;
      suffix += 1;
      candidate = `${desired}-${suffix}`;
    }
  }

  // NOTE: captures scalar fields only; category/tag associations are not part of
  // the revision snapshot, so restoring a revision restores text, not taxonomy.
  private snapshot(post: PostWithRelations): Prisma.InputJsonValue {
    return {
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content: post.content,
      status: post.status,
    };
  }

  private mapRelationError(error: unknown): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return new BadRequestException('One or more referenced categories or tags do not exist.');
      }
      // Lost a slug-uniqueness race between the check and the insert.
      if (error.code === 'P2002') {
        return new ConflictException('A post with this slug already exists.');
      }
    }
    return error instanceof Error ? error : new Error('Unknown error');
  }

  private toSummary(post: PostWithRelations): PostSummary {
    return {
      id: post.id,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      status: post.status,
      publishedAt: post.publishedAt?.toISOString() ?? null,
      author: post.author
        ? { id: post.author.id, name: post.author.name, image: post.author.image }
        : null,
      categories: post.categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
      tags: post.tags.map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };
  }

  private toDetail(post: PostWithRelations): PostDetail {
    return { ...this.toSummary(post), content: post.content };
  }
}
