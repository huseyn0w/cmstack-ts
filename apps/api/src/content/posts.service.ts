import type {
  CreatePostInput,
  PostDetail,
  PostList,
  PostListQuery,
  PostSummary,
  UpdatePostInput,
} from '@cmstack-ts/config';
import {
  POST_REPOSITORY,
  type PostRepository,
  type PostUpdateData,
  type PostWithRelations,
  Prisma,
  REVISION_REPOSITORY,
  type RevisionRepository,
} from '@cmstack-ts/db';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HookRegistry } from '../plugins/hook-registry';
import { HtmlSanitizerService } from './html-sanitizer.service';
import { slugify } from './slug';

export interface RevisionView {
  id: string;
  authorId: string | null;
  snapshot: unknown;
  createdAt: string;
}

@Injectable()
export class PostsService {
  constructor(
    @Inject(POST_REPOSITORY) private readonly posts: PostRepository,
    @Inject(REVISION_REPOSITORY) private readonly revisionRepo: RevisionRepository,
    private readonly sanitizer: HtmlSanitizerService,
    private readonly hooks: HookRegistry,
  ) {}

  async create(input: CreatePostInput, authorId: string): Promise<PostDetail> {
    const slug = await this.uniqueSlug(input.slug ?? slugify(input.title));
    const status = input.status ?? 'DRAFT';
    try {
      const post = await this.posts.create({
        title: input.title,
        slug,
        excerpt: input.excerpt ?? null,
        content: this.sanitizer.sanitize(input.content ?? ''),
        status,
        publishedAt: status === 'PUBLISHED' ? new Date() : null,
        authorId,
        categoryIds: input.categoryIds,
        tagIds: input.tagIds,
      });
      if (status === 'PUBLISHED') {
        await this.hooks.emit('post.published', {
          id: post.id,
          slug: post.slug,
          title: post.title,
        });
      }
      return this.toDetail(post);
    } catch (error) {
      throw this.mapRelationError(error);
    }
  }

  async update(id: string, input: UpdatePostInput, authorId: string): Promise<PostDetail> {
    const existing = await this.posts.findActiveById(id);
    if (!existing) {
      throw new NotFoundException('Post not found.');
    }

    // Snapshot the current version before mutating, for revision history.
    // NOTE: deliberately a separate write (not transactional with the update) —
    // matching prior behaviour where a failed update still leaves the snapshot.
    await this.revisionRepo.create({ postId: id, authorId, snapshot: this.snapshot(existing) });

    const data: PostUpdateData = {};
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
    if (input.categoryIds !== undefined) data.categoryIds = input.categoryIds;
    if (input.tagIds !== undefined) data.tagIds = input.tagIds;

    const becamePublished = input.status === 'PUBLISHED' && existing.status !== 'PUBLISHED';

    try {
      const post = await this.posts.update(id, data);
      if (becamePublished) {
        await this.hooks.emit('post.published', {
          id: post.id,
          slug: post.slug,
          title: post.title,
        });
      }
      return this.toDetail(post);
    } catch (error) {
      throw this.mapRelationError(error);
    }
  }

  async list(query: PostListQuery, opts: { publicOnly: boolean }): Promise<PostList> {
    const { items, total } = await this.posts.listAndCount({
      publicOnly: opts.publicOnly,
      includeTrashed: query.includeTrashed,
      status: query.status,
      categorySlug: query.categorySlug,
      tagSlug: query.tagSlug,
      q: query.q,
      page: query.page,
      perPage: query.perPage,
    });

    return {
      items: items.map((p) => this.toSummary(p)),
      total,
      page: query.page,
      perPage: query.perPage,
    };
  }

  async findById(id: string): Promise<PostDetail> {
    const post = await this.posts.findById(id);
    if (!post) throw new NotFoundException('Post not found.');
    return this.toDetail(post);
  }

  /** Published posts by a given author (newest first), as summaries. */
  async publicByAuthor(authorId: string): Promise<PostSummary[]> {
    const posts = await this.posts.publicByAuthor(authorId);
    return posts.map((p) => this.toSummary(p));
  }

  async findPublicBySlug(slug: string): Promise<PostDetail> {
    const post = await this.posts.findPublicBySlug(slug);
    if (!post) throw new NotFoundException('Post not found.');
    // Let plugins transform the public post just before it is returned.
    return this.hooks.applyFilters('public.post.render', this.toDetail(post));
  }

  async softDelete(id: string): Promise<void> {
    await this.ensureExists(id);
    await this.posts.setDeletedAt(id, new Date());
  }

  async restore(id: string): Promise<PostDetail> {
    await this.ensureExists(id);
    const post = await this.posts.restore(id);
    return this.toDetail(post);
  }

  async destroy(id: string): Promise<void> {
    await this.ensureExists(id);
    await this.posts.hardDelete(id);
  }

  async revisions(postId: string): Promise<RevisionView[]> {
    await this.ensureExists(postId);
    const revisions = await this.revisionRepo.listForPost(postId);
    return revisions.map((r) => ({
      id: r.id,
      authorId: r.authorId,
      snapshot: r.snapshot,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  private async ensureExists(id: string): Promise<void> {
    if (!(await this.posts.exists(id))) throw new NotFoundException('Post not found.');
  }

  private async uniqueSlug(desired: string, excludeId?: string): Promise<string> {
    let candidate = desired;
    let suffix = 1;
    while (true) {
      const existing = await this.posts.findIdBySlug(candidate);
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
