import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateCategoryInput, UpdateCategoryInput } from '@typress/config';
import { Prisma, type PrismaClient } from '@typress/db';
import { PRISMA } from '../prisma/prisma.module';
import { slugify } from './slug';

export interface CategoryView {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class CategoriesService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async create(input: CreateCategoryInput): Promise<CategoryView> {
    const slug = await this.uniqueSlug(input.slug ?? slugify(input.name));

    if (input.parentId != null) {
      const parent = await this.prisma.category.findUnique({
        where: { id: input.parentId },
        select: { id: true },
      });
      if (!parent) throw new BadRequestException('Invalid parent category.');
    }

    try {
      const category = await this.prisma.category.create({
        data: {
          name: input.name,
          slug,
          description: input.description ?? null,
          parentId: input.parentId ?? null,
        },
      });
      return this.toView(category);
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async update(id: string, input: UpdateCategoryInput): Promise<CategoryView> {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Category not found.');

    if (input.parentId != null) {
      if (input.parentId === id) {
        throw new BadRequestException('A category cannot be its own parent.');
      }
      const parent = await this.prisma.category.findUnique({
        where: { id: input.parentId },
        select: { id: true },
      });
      if (!parent) throw new BadRequestException('Invalid parent category.');
    }

    const data: Prisma.CategoryUncheckedUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.slug !== undefined) data.slug = await this.uniqueSlug(input.slug, id);
    if (input.description !== undefined) data.description = input.description ?? null;
    if ('parentId' in input) data.parentId = input.parentId ?? null;

    try {
      const category = await this.prisma.category.update({ where: { id }, data });
      return this.toView(category);
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async list(): Promise<CategoryView[]> {
    const categories = await this.prisma.category.findMany({ orderBy: { name: 'asc' } });
    return categories.map((c) => this.toView(c));
  }

  async findById(id: string): Promise<CategoryView> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Category not found.');
    return this.toView(category);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.category.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Category not found.');
    await this.prisma.category.delete({ where: { id } });
  }

  private async uniqueSlug(desired: string, excludeId?: string): Promise<string> {
    let candidate = desired;
    let suffix = 1;
    while (true) {
      const existing = await this.prisma.category.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!existing || existing.id === excludeId) return candidate;
      suffix += 1;
      candidate = `${desired}-${suffix}`;
    }
  }

  private mapError(error: unknown): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return new BadRequestException('Invalid parent category.');
    }
    return error instanceof Error ? error : new Error('Unknown error');
  }

  private toView(category: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    parentId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): CategoryView {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      parentId: category.parentId,
      createdAt: category.createdAt.toISOString(),
      updatedAt: category.updatedAt.toISOString(),
    };
  }
}
