import {
  type CreatePostInput,
  DEFAULT_LOCALE,
  type PostDetail,
  type PostList,
  type PostListQuery,
  type PostSummary,
  type PostTranslation,
  type PostTranslationInput,
  type UpdatePostInput,
} from '@cmstack-ts/config';
import {
  type LocalizedPost,
  POST_REPOSITORY,
  type PostRepository,
  type PostTranslationData,
  type PostTranslationRow,
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
import { CACHE_NS, cacheKey } from '../cache/cache.keys';
import { CacheService } from '../cache/cache.service';
import { HookRegistry } from '../plugins/hook-registry';
import { HtmlSanitizerService } from './html-sanitizer.service';
import { localizeContent } from './localize';
import { revisionToPostUpdate } from './revision-snapshot';
import { slugify } from './slug';

export interface RevisionView {
  id: string;
  authorId: string | null;
  snapshot: unknown;
  createdAt: string;
}

/** Fields that carry a per-locale translation (see {@link localizeContent}). */
const LOCALIZED_POST_FIELDS = [
  'title',
  'excerpt',
  'content',
  'metaTitle',
  'metaDescription',
] as const;

@Injectable()
export class PostsService {
  constructor(
    @Inject(POST_REPOSITORY) private readonly posts: PostRepository,
    @Inject(REVISION_REPOSITORY) private readonly revisionRepo: RevisionRepository,
    private readonly sanitizer: HtmlSanitizerService,
    private readonly hooks: HookRegistry,
    private readonly cache: CacheService,
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
        scheduledAt:
          status === 'PUBLISHED' ? null : input.scheduledAt ? new Date(input.scheduledAt) : null,
        metaTitle: input.metaTitle ?? null,
        metaDescription: input.metaDescription ?? null,
        canonicalUrl: input.canonicalUrl ?? null,
        noindex: input.noindex ?? false,
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
      await this.hooks.emit('content.changed', { type: 'post', id: post.id, slug: post.slug });
      return this.toDetail(post, []);
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
    if (input.metaTitle !== undefined) data.metaTitle = input.metaTitle ?? null;
    if (input.metaDescription !== undefined) data.metaDescription = input.metaDescription ?? null;
    if (input.canonicalUrl !== undefined) data.canonicalUrl = input.canonicalUrl ?? null;
    if (input.noindex !== undefined) data.noindex = input.noindex;
    if (input.scheduledAt !== undefined) {
      data.scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
    }
    // A manual publish cancels any pending schedule.
    if (data.status === 'PUBLISHED') data.scheduledAt = null;
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
      await this.hooks.emit('content.changed', { type: 'post', id: post.id, slug: post.slug });
      return this.toDetail(post, []);
    } catch (error) {
      throw this.mapRelationError(error);
    }
  }

  async list(
    query: PostListQuery,
    opts: { publicOnly: boolean },
    locale: string = DEFAULT_LOCALE,
  ): Promise<PostList> {
    // Only the public list is cached; admin reads (draft/trashed) bypass the cache.
    if (!opts.publicOnly) return this.computeList(query, opts, locale);
    const disc = `list:${locale}:${JSON.stringify(query)}`;
    return this.cache.getOrSet(cacheKey(CACHE_NS.POSTS, disc), () =>
      this.computeList(query, opts, locale),
    );
  }

  private async computeList(
    query: PostListQuery,
    opts: { publicOnly: boolean },
    locale: string,
  ): Promise<PostList> {
    const { items, total } = await this.posts.listAndCount(
      {
        publicOnly: opts.publicOnly,
        includeTrashed: query.includeTrashed,
        status: query.status,
        categorySlug: query.categorySlug,
        tagSlug: query.tagSlug,
        q: query.q,
        page: query.page,
        perPage: query.perPage,
      },
      this.translationLocale(locale),
    );

    return {
      items: items.map((p) => this.toSummary(this.localize(p))),
      total,
      page: query.page,
      perPage: query.perPage,
    };
  }

  /** Admin read: the post with every translation row (for the per-locale editor). */
  async findById(id: string): Promise<PostDetail> {
    const post = await this.posts.findByIdWithTranslations(id);
    if (!post) throw new NotFoundException('Post not found.');
    return this.toDetail(post, this.toTranslationViews(post.translations ?? []));
  }

  /** Published posts by a given author (newest first), as summaries. */
  async publicByAuthor(authorId: string, locale: string = DEFAULT_LOCALE): Promise<PostSummary[]> {
    const posts = await this.posts.publicByAuthor(authorId, this.translationLocale(locale));
    return posts.map((p) => this.toSummary(this.localize(p)));
  }

  async findPublicBySlug(slug: string, locale: string = DEFAULT_LOCALE): Promise<PostDetail> {
    // Cache the pre-filter localized detail; the plugin filter runs on every read
    // (after the cache) so runtime plugin toggles are never frozen into the cache.
    const detail = await this.cache.getOrSet(
      cacheKey(CACHE_NS.POSTS, `detail:${slug}:${locale}`),
      async () => {
        const post = await this.posts.findPublicBySlug(slug, this.translationLocale(locale));
        if (!post) throw new NotFoundException('Post not found.');
        // Public detail is already localized; the raw translation rows are not leaked.
        return this.toDetail(this.localize(post), []);
      },
    );
    // Let plugins transform the public post just before it is returned.
    return this.hooks.applyFilters('public.post.render', detail);
  }

  /** Create or replace a post's translation for a non-default locale. */
  async upsertTranslation(id: string, locale: string, input: PostTranslationInput): Promise<void> {
    await this.ensureActive(id);
    // An empty field is "no override" (the locale falls back to base), so empty
    // strings are never stored — otherwise an empty value would overlay the base.
    const data: PostTranslationData = {};
    if (input.title) data.title = input.title;
    if (input.excerpt) data.excerpt = input.excerpt;
    if (input.content) data.content = this.sanitizer.sanitize(input.content);
    if (input.metaTitle) data.metaTitle = input.metaTitle;
    if (input.metaDescription) data.metaDescription = input.metaDescription;

    // Nothing to store -> clear the translation row entirely.
    if (Object.keys(data).length === 0) {
      await this.deleteTranslation(id, locale);
      return;
    }
    await this.posts.upsertTranslation(id, locale, data);
    await this.hooks.emit('content.changed', { type: 'post', id });
  }

  /** Remove a post's translation for a locale (idempotent). */
  async deleteTranslation(id: string, locale: string): Promise<void> {
    await this.ensureActive(id);
    try {
      await this.posts.deleteTranslation(id, locale);
    } catch (error) {
      // Deleting an absent translation is a no-op, not a 404.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') return;
      throw error;
    }
    await this.hooks.emit('content.changed', { type: 'post', id });
  }

  async softDelete(id: string): Promise<void> {
    await this.ensureExists(id);
    await this.posts.setDeletedAt(id, new Date());
    await this.hooks.emit('content.changed', { type: 'post', id });
  }

  async restore(id: string): Promise<PostDetail> {
    await this.ensureExists(id);
    const post = await this.posts.restore(id);
    await this.hooks.emit('content.changed', { type: 'post', id: post.id, slug: post.slug });
    return this.toDetail(post, []);
  }

  async destroy(id: string): Promise<void> {
    await this.ensureExists(id);
    await this.posts.hardDelete(id);
    await this.hooks.emit('content.changed', { type: 'post', id });
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

  /** Restore a prior revision's scalar fields. Reuses update (snapshots the
   * current state first → reversible; sanitizes content; emits content.changed). */
  async restoreRevision(id: string, revisionId: string, authorId: string): Promise<PostDetail> {
    const revision = await this.revisionRepo.findById(revisionId);
    if (!revision || revision.postId !== id) throw new NotFoundException('Revision not found.');
    return this.update(id, revisionToPostUpdate(revision.snapshot), authorId);
  }

  /** Publish a single due draft (race-safe). Goes through repo.update directly
   * (no revision snapshot for an automated status flip) and emits the publish +
   * cache-invalidation events. */
  async publishScheduled(id: string): Promise<void> {
    const post = await this.posts.findActiveById(id);
    if (!post || post.status !== 'DRAFT' || !post.scheduledAt) return;
    const data: PostUpdateData = { status: 'PUBLISHED', scheduledAt: null };
    if (post.publishedAt === null) data.publishedAt = new Date();
    const updated = await this.posts.update(id, data);
    await this.hooks.emit('post.published', {
      id: updated.id,
      slug: updated.slug,
      title: updated.title,
    });
    await this.hooks.emit('content.changed', { type: 'post', id: updated.id, slug: updated.slug });
  }

  /** Publish all drafts whose scheduledAt is due. Returns the count published. */
  async publishDue(now: Date): Promise<number> {
    const due = await this.posts.findDueScheduledIds(now);
    for (const { id } of due) await this.publishScheduled(id);
    return due.length;
  }

  private async ensureExists(id: string): Promise<void> {
    if (!(await this.posts.exists(id))) throw new NotFoundException('Post not found.');
  }

  private async ensureActive(id: string): Promise<void> {
    if (!(await this.posts.findActiveById(id))) throw new NotFoundException('Post not found.');
  }

  /** The locale to overlay, or `undefined` for the default locale (base-only read). */
  private translationLocale(locale: string): string | undefined {
    return locale === DEFAULT_LOCALE ? undefined : locale;
  }

  /** Overlay the (already locale-filtered) translation row onto the base post. */
  private localize(post: LocalizedPost): LocalizedPost {
    return localizeContent(post, post.translations?.[0] ?? null, LOCALIZED_POST_FIELDS);
  }

  private toTranslationViews(rows: PostTranslationRow[]): PostTranslation[] {
    return rows.map((r) => ({
      locale: r.locale,
      title: r.title,
      excerpt: r.excerpt,
      content: r.content,
      metaTitle: r.metaTitle,
      metaDescription: r.metaDescription,
    }));
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
      scheduledAt: post.scheduledAt?.toISOString() ?? null,
      noindex: post.noindex,
      author: post.author
        ? { id: post.author.id, name: post.author.name, image: post.author.image }
        : null,
      categories: post.categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
      tags: post.tags.map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };
  }

  private toDetail(post: PostWithRelations, translations: PostTranslation[]): PostDetail {
    return {
      ...this.toSummary(post),
      content: post.content,
      metaTitle: post.metaTitle,
      metaDescription: post.metaDescription,
      canonicalUrl: post.canonicalUrl,
      translations,
    };
  }
}
