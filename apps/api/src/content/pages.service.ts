import type { CreatePageInput, PageDetail, UpdatePageInput } from '@cmstack-ts/config';
import {
  PAGE_REPOSITORY,
  type PageRepository,
  type PageUpdateData,
  type PageWithAuthor,
  Prisma,
  REVISION_REPOSITORY,
  type RevisionRepository,
} from '@cmstack-ts/db';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { HtmlSanitizerService } from './html-sanitizer.service';
import type { RevisionView } from './posts.service';
import { slugify } from './slug';

@Injectable()
export class PagesService {
  constructor(
    @Inject(PAGE_REPOSITORY) private readonly pages: PageRepository,
    @Inject(REVISION_REPOSITORY) private readonly revisionRepo: RevisionRepository,
    private readonly sanitizer: HtmlSanitizerService,
  ) {}

  async create(input: CreatePageInput, authorId: string): Promise<PageDetail> {
    const slug = await this.uniqueSlug(input.slug ?? slugify(input.title));
    const page = await this.pages.create({
      title: input.title,
      slug,
      content: this.sanitizer.sanitize(input.content ?? ''),
      status: input.status ?? 'DRAFT',
      authorId,
    });
    return this.toDetail(page);
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

    const page = await this.pages.update(id, data);
    return this.toDetail(page);
  }

  async list(opts: { includeTrashed?: boolean }): Promise<PageDetail[]> {
    const pages = await this.pages.list(opts);
    return pages.map((p) => this.toDetail(p));
  }

  async findById(id: string): Promise<PageDetail> {
    const page = await this.pages.findById(id);
    if (!page) throw new NotFoundException('Page not found.');
    return this.toDetail(page);
  }

  async findPublicBySlug(slug: string): Promise<PageDetail> {
    const page = await this.pages.findPublicBySlug(slug);
    if (!page) throw new NotFoundException('Page not found.');
    return this.toDetail(page);
  }

  async softDelete(id: string): Promise<void> {
    await this.ensureExists(id);
    await this.pages.setDeletedAt(id, new Date());
  }

  async restore(id: string): Promise<PageDetail> {
    await this.ensureExists(id);
    const page = await this.pages.restore(id);
    return this.toDetail(page);
  }

  async destroy(id: string): Promise<void> {
    await this.ensureExists(id);
    await this.pages.hardDelete(id);
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

  private async ensureExists(id: string): Promise<void> {
    if (!(await this.pages.exists(id))) throw new NotFoundException('Page not found.');
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

  private toDetail(page: PageWithAuthor): PageDetail {
    return {
      id: page.id,
      title: page.title,
      slug: page.slug,
      content: page.content,
      status: page.status,
      author: page.author
        ? { id: page.author.id, name: page.author.name, image: page.author.image }
        : null,
      createdAt: page.createdAt.toISOString(),
      updatedAt: page.updatedAt.toISOString(),
    };
  }
}
