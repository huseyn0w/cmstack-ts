import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateTagInput, UpdateTagInput } from '@typress/config';
import { Prisma, type PrismaClient } from '@typress/db';
import { PRISMA } from '../prisma/prisma.module';
import { slugify } from './slug';

export interface TagView {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class TagsService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async create(input: CreateTagInput): Promise<TagView> {
    const slug = await this.uniqueSlug(input.slug ?? slugify(input.name));
    const tag = await this.prisma.tag.create({
      data: { name: input.name, slug },
    });
    return this.toView(tag);
  }

  async update(id: string, input: UpdateTagInput): Promise<TagView> {
    const existing = await this.prisma.tag.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Tag not found.');

    const data: Prisma.TagUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.slug !== undefined) data.slug = await this.uniqueSlug(input.slug, id);

    const tag = await this.prisma.tag.update({ where: { id }, data });
    return this.toView(tag);
  }

  async list(): Promise<TagView[]> {
    const tags = await this.prisma.tag.findMany({ orderBy: { name: 'asc' } });
    return tags.map((t) => this.toView(t));
  }

  async findById(id: string): Promise<TagView> {
    const tag = await this.prisma.tag.findUnique({ where: { id } });
    if (!tag) throw new NotFoundException('Tag not found.');
    return this.toView(tag);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.tag.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Tag not found.');
    await this.prisma.tag.delete({ where: { id } });
  }

  private async uniqueSlug(desired: string, excludeId?: string): Promise<string> {
    let candidate = desired;
    let suffix = 1;
    while (true) {
      const existing = await this.prisma.tag.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!existing || existing.id === excludeId) return candidate;
      suffix += 1;
      candidate = `${desired}-${suffix}`;
    }
  }

  private toView(tag: {
    id: string;
    name: string;
    slug: string;
    createdAt: Date;
    updatedAt: Date;
  }): TagView {
    return {
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      createdAt: tag.createdAt.toISOString(),
      updatedAt: tag.updatedAt.toISOString(),
    };
  }
}
