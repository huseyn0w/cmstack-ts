import {
  type CreatePageInput,
  DEFAULT_LOCALE,
  type PageDetail,
  type PageTranslation,
  type PageTranslationInput,
  type UpdatePageInput,
} from '@cmstack-ts/config';
import {
  type LocalizedPage,
  PAGE_REPOSITORY,
  type PageRepository,
  type PageTranslationData,
  type PageTranslationRow,
  type PageUpdateData,
  type PageWithAuthor,
  Prisma,
  REVISION_REPOSITORY,
  type RevisionRepository,
} from '@cmstack-ts/db';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CACHE_NS, cacheKey } from '../cache/cache.keys';
import { CacheService } from '../cache/cache.service';
import { HookRegistry } from '../plugins/hook-registry';
import { HtmlSanitizerService } from './html-sanitizer.service';
import { localizeContent } from './localize';
import type { RevisionView } from './posts.service';
import { revisionToPageUpdate } from './revision-snapshot';
import { slugify } from './slug';

/** Fields that carry a per-locale translation (pages have no excerpt). */
const LOCALIZED_PAGE_FIELDS = ['title', 'content', 'metaTitle', 'metaDescription'] as const;

@Injectable()
export class PagesService {
  constructor(
    @Inject(PAGE_REPOSITORY) private readonly pages: PageRepository,
    @Inject(REVISION_REPOSITORY) private readonly revisionRepo: RevisionRepository,
    private readonly sanitizer: HtmlSanitizerService,
    private readonly hooks: HookRegistry,
    private readonly cache: CacheService,
  ) {}

  async create(input: CreatePageInput, authorId: string): Promise<PageDetail> {
    const slug = await this.uniqueSlug(input.slug ?? slugify(input.title));
    const page = await this.pages.create({
      title: input.title,
      slug,
      content: this.sanitizer.sanitize(input.content ?? ''),
      status: input.status ?? 'DRAFT',
      scheduledAt:
        input.status === 'PUBLISHED' ? null : input.scheduledAt ? new Date(input.scheduledAt) : null,
      metaTitle: input.metaTitle ?? null,
      metaDescription: input.metaDescription ?? null,
      canonicalUrl: input.canonicalUrl ?? null,
      noindex: input.noindex ?? false,
      authorId,
    });
    await this.hooks.emit('content.changed', { type: 'page', id: page.id, slug: page.slug });
    return this.toDetail(page, []);
  }

  async update(id: string, input: UpdatePageInput, authorId: string): Promise<PageDetail> {
    const existing = await this.pages.findActiveById(id);
    if (!existing) throw new NotFoundException('Page not found.');

    await this.revisionRepo.create({ pageId: id, authorId, snapshot: this.snapshot(existing) });

    const data: PageUpdateData = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.slug !== undefined) data.slug = await this.uniqueSlug(input.slug, id);
    if (input.content !== undefined) data.content = this.sanitizer.sanitize(input.content);
    if (input.status !== undefined) data.status = input.status;
    if (input.metaTitle !== undefined) data.metaTitle = input.metaTitle ?? null;
    if (input.metaDescription !== undefined) data.metaDescription = input.metaDescription ?? null;
    if (input.canonicalUrl !== undefined) data.canonicalUrl = input.canonicalUrl ?? null;
    if (input.noindex !== undefined) data.noindex = input.noindex;
    if (input.scheduledAt !== undefined) {
      data.scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
    }
    // A manual publish cancels any pending schedule.
    if (data.status === 'PUBLISHED') data.scheduledAt = null;

    const page = await this.pages.update(id, data);
    await this.hooks.emit('content.changed', { type: 'page', id: page.id, slug: page.slug });
    return this.toDetail(page, []);
  }

  async list(opts: { includeTrashed?: boolean }): Promise<PageDetail[]> {
    const pages = await this.pages.list(opts);
    return pages.map((p) => this.toDetail(p, []));
  }

  /** Admin read: the page with every translation row (for the per-locale editor). */
  async findById(id: string): Promise<PageDetail> {
    const page = await this.pages.findByIdWithTranslations(id);
    if (!page) throw new NotFoundException('Page not found.');
    return this.toDetail(page, this.toTranslationViews(page.translations ?? []));
  }

  async findPublicBySlug(slug: string, locale: string = DEFAULT_LOCALE): Promise<PageDetail> {
    return this.cache.getOrSet(cacheKey(CACHE_NS.PAGES, `detail:${slug}:${locale}`), async () => {
      const page = await this.pages.findPublicBySlug(slug, this.translationLocale(locale));
      if (!page) throw new NotFoundException('Page not found.');
      return this.toDetail(this.localize(page), []);
    });
  }

  /** Create or replace a page's translation for a non-default locale. */
  async upsertTranslation(id: string, locale: string, input: PageTranslationInput): Promise<void> {
    await this.ensureActive(id);
    // An empty field is "no override" (the locale falls back to base), so empty
    // strings are never stored — otherwise an empty value would overlay the base.
    const data: PageTranslationData = {};
    if (input.title) data.title = input.title;
    if (input.content) data.content = this.sanitizer.sanitize(input.content);
    if (input.metaTitle) data.metaTitle = input.metaTitle;
    if (input.metaDescription) data.metaDescription = input.metaDescription;

    if (Object.keys(data).length === 0) {
      await this.deleteTranslation(id, locale);
      return;
    }
    await this.pages.upsertTranslation(id, locale, data);
    await this.hooks.emit('content.changed', { type: 'page', id });
  }

  /** Remove a page's translation for a locale (idempotent). */
  async deleteTranslation(id: string, locale: string): Promise<void> {
    await this.ensureActive(id);
    try {
      await this.pages.deleteTranslation(id, locale);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') return;
      throw error;
    }
    await this.hooks.emit('content.changed', { type: 'page', id });
  }

  async softDelete(id: string): Promise<void> {
    await this.ensureExists(id);
    await this.pages.setDeletedAt(id, new Date());
    await this.hooks.emit('content.changed', { type: 'page', id });
  }

  async restore(id: string): Promise<PageDetail> {
    await this.ensureExists(id);
    const page = await this.pages.restore(id);
    await this.hooks.emit('content.changed', { type: 'page', id: page.id, slug: page.slug });
    return this.toDetail(page, []);
  }

  async destroy(id: string): Promise<void> {
    await this.ensureExists(id);
    await this.pages.hardDelete(id);
    await this.hooks.emit('content.changed', { type: 'page', id });
  }

  async revisions(pageId: string): Promise<RevisionView[]> {
    await this.ensureExists(pageId);
    const revisions = await this.revisionRepo.listForPage(pageId);
    return revisions.map((r) => ({
      id: r.id,
      authorId: r.authorId,
      snapshot: r.snapshot,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** Restore a prior page revision's scalar fields (reuses update → reversible). */
  async restoreRevision(id: string, revisionId: string, authorId: string): Promise<PageDetail> {
    const revision = await this.revisionRepo.findById(revisionId);
    if (!revision || revision.pageId !== id) throw new NotFoundException('Revision not found.');
    return this.update(id, revisionToPageUpdate(revision.snapshot), authorId);
  }

  /** Publish a single due draft page (race-safe; reuses repo.update). Pages have
   * no publishedAt and emit only content.changed (post.published is post-only). */
  async publishScheduled(id: string): Promise<void> {
    const page = await this.pages.findActiveById(id);
    if (!page || page.status !== 'DRAFT' || !page.scheduledAt) return;
    const updated = await this.pages.update(id, { status: 'PUBLISHED', scheduledAt: null });
    await this.hooks.emit('content.changed', { type: 'page', id: updated.id, slug: updated.slug });
  }

  /** Publish all draft pages whose scheduledAt is due. Returns the count published. */
  async publishDue(now: Date): Promise<number> {
    const due = await this.pages.findDueScheduledIds(now);
    for (const { id } of due) await this.publishScheduled(id);
    return due.length;
  }

  private async ensureExists(id: string): Promise<void> {
    if (!(await this.pages.exists(id))) throw new NotFoundException('Page not found.');
  }

  private async ensureActive(id: string): Promise<void> {
    if (!(await this.pages.findActiveById(id))) throw new NotFoundException('Page not found.');
  }

  private translationLocale(locale: string): string | undefined {
    return locale === DEFAULT_LOCALE ? undefined : locale;
  }

  private localize(page: LocalizedPage): LocalizedPage {
    return localizeContent(page, page.translations?.[0] ?? null, LOCALIZED_PAGE_FIELDS);
  }

  private toTranslationViews(rows: PageTranslationRow[]): PageTranslation[] {
    return rows.map((r) => ({
      locale: r.locale,
      title: r.title,
      content: r.content,
      metaTitle: r.metaTitle,
      metaDescription: r.metaDescription,
    }));
  }

  private async uniqueSlug(desired: string, excludeId?: string): Promise<string> {
    let candidate = desired;
    let suffix = 1;
    while (true) {
      const existing = await this.pages.findIdBySlug(candidate);
      if (!existing || existing.id === excludeId) return candidate;
      suffix += 1;
      candidate = `${desired}-${suffix}`;
    }
  }

  private snapshot(page: PageWithAuthor): Prisma.InputJsonValue {
    return { title: page.title, slug: page.slug, content: page.content, status: page.status };
  }

  private toDetail(page: PageWithAuthor, translations: PageTranslation[]): PageDetail {
    return {
      id: page.id,
      title: page.title,
      slug: page.slug,
      content: page.content,
      status: page.status,
      metaTitle: page.metaTitle,
      metaDescription: page.metaDescription,
      canonicalUrl: page.canonicalUrl,
      noindex: page.noindex,
      author: page.author
        ? { id: page.author.id, name: page.author.name, image: page.author.image }
        : null,
      translations,
      createdAt: page.createdAt.toISOString(),
      updatedAt: page.updatedAt.toISOString(),
    };
  }
}
