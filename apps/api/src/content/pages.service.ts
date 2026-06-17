import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { CreatePageInput, PageDetail, UpdatePageInput } from '@typress/config';
import { Prisma, type PrismaClient } from '@typress/db';
import { PRISMA } from '../prisma/prisma.module';
import { HtmlSanitizerService } from './html-sanitizer.service';
import type { RevisionView } from './posts.service';
import { slugify } from './slug';

const pageInclude = { author: true } satisfies Prisma.PageInclude;
type PageWithAuthor = Prisma.PageGetPayload<{ include: typeof pageInclude }>;

@Injectable()
export class PagesService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    private readonly sanitizer: HtmlSanitizerService,
  ) {}

  async create(input: CreatePageInput, authorId: string): Promise<PageDetail> {
    const slug = await this.uniqueSlug(input.slug ?? slugify(input.title));
    const page = await this.prisma.page.create({
      data: {
        title: input.title,
        slug,
        content: this.sanitizer.sanitize(input.content ?? ''),
        status: input.status ?? 'DRAFT',
        authorId,
      },
      include: pageInclude,
    });
    return this.toDetail(page);
  }

  async update(id: string, input: UpdatePageInput, authorId: string): Promise<PageDetail> {
    const existing = await this.prisma.page.findFirst({
      where: { id, deletedAt: null },
      include: pageInclude,
    });
    if (!existing) throw new NotFoundException('Page not found.');

    await this.prisma.revision.create({
      data: { pageId: id, authorId, snapshot: this.snapshot(existing) },
    });

    const data: Prisma.PageUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.slug !== undefined) data.slug = await this.uniqueSlug(input.slug, id);
    if (input.content !== undefined) data.content = this.sanitizer.sanitize(input.content);
    if (input.status !== undefined) data.status = input.status;

    const page = await this.prisma.page.update({ where: { id }, data, include: pageInclude });
    return this.toDetail(page);
  }

  async list(opts: { includeTrashed?: boolean }): Promise<PageDetail[]> {
    const pages = await this.prisma.page.findMany({
      where: opts.includeTrashed ? {} : { deletedAt: null },
      include: pageInclude,
      orderBy: { updatedAt: 'desc' },
    });
    return pages.map((p) => this.toDetail(p));
  }

  async findById(id: string): Promise<PageDetail> {
    const page = await this.prisma.page.findUnique({ where: { id }, include: pageInclude });
    if (!page) throw new NotFoundException('Page not found.');
    return this.toDetail(page);
  }

  async findPublicBySlug(slug: string): Promise<PageDetail> {
    const page = await this.prisma.page.findFirst({
      where: { slug, status: 'PUBLISHED', deletedAt: null },
      include: pageInclude,
    });
    if (!page) throw new NotFoundException('Page not found.');
    return this.toDetail(page);
  }

  async softDelete(id: string): Promise<void> {
    await this.ensureExists(id);
    await this.prisma.page.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async restore(id: string): Promise<PageDetail> {
    await this.ensureExists(id);
    const page = await this.prisma.page.update({
      where: { id },
      data: { deletedAt: null },
      include: pageInclude,
    });
    return this.toDetail(page);
  }

  async destroy(id: string): Promise<void> {
    await this.ensureExists(id);
    await this.prisma.page.delete({ where: { id } });
  }

  async revisions(pageId: string): Promise<RevisionView[]> {
    await this.ensureExists(pageId);
    const revisions = await this.prisma.revision.findMany({
      where: { pageId },
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
    const page = await this.prisma.page.findUnique({ where: { id }, select: { id: true } });
    if (!page) throw new NotFoundException('Page not found.');
  }

  private async uniqueSlug(desired: string, excludeId?: string): Promise<string> {
    let candidate = desired;
    let suffix = 1;
    while (true) {
      const existing = await this.prisma.page.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
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
