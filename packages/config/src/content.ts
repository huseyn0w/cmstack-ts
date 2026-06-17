import { z } from 'zod';

/**
 * Shared content contracts (posts, pages, categories, tags). Inputs are
 * validated at the API boundary; the output schemas let the web app parse API
 * responses against the same shapes. HTML content is sanitized server-side.
 */

export const contentStatusSchema = z.enum(['DRAFT', 'PUBLISHED']);
export type ContentStatus = z.infer<typeof contentStatusSchema>;

/** URL-friendly slug: lowercase words separated by single hyphens. */
export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Must be a lowercase, hyphen-separated slug');

const idList = z.array(z.string().min(1));

// --- Posts -------------------------------------------------------------------

export const createPostSchema = z.object({
  title: z.string().trim().min(1).max(200),
  slug: slugSchema.optional(),
  excerpt: z.string().trim().max(500).optional(),
  content: z.string().default(''),
  status: contentStatusSchema.optional(),
  categoryIds: idList.optional(),
  tagIds: idList.optional(),
});
export type CreatePostInput = z.infer<typeof createPostSchema>;

export const updatePostSchema = createPostSchema.partial();
export type UpdatePostInput = z.infer<typeof updatePostSchema>;

export const postListQuerySchema = z.object({
  status: contentStatusSchema.optional(),
  categorySlug: z.string().optional(),
  tagSlug: z.string().optional(),
  q: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(10),
  includeTrashed: z.coerce.boolean().optional(),
});
export type PostListQuery = z.infer<typeof postListQuerySchema>;

// --- Pages -------------------------------------------------------------------

export const createPageSchema = z.object({
  title: z.string().trim().min(1).max(200),
  slug: slugSchema.optional(),
  content: z.string().default(''),
  status: contentStatusSchema.optional(),
});
export type CreatePageInput = z.infer<typeof createPageSchema>;

export const updatePageSchema = createPageSchema.partial();
export type UpdatePageInput = z.infer<typeof updatePageSchema>;

// --- Categories --------------------------------------------------------------

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: slugSchema.optional(),
  description: z.string().trim().max(500).optional(),
  parentId: z.string().min(1).nullable().optional(),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema.partial();
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

// --- Tags --------------------------------------------------------------------

export const createTagSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: slugSchema.optional(),
});
export type CreateTagInput = z.infer<typeof createTagSchema>;

export const updateTagSchema = createTagSchema.partial();
export type UpdateTagInput = z.infer<typeof updateTagSchema>;

// --- Output shapes (consumed by the web app) --------------------------------

export const contentAuthorSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  image: z.string().nullable(),
});

export const termSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});

export const postSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  excerpt: z.string().nullable(),
  status: contentStatusSchema,
  publishedAt: z.string().datetime().nullable(),
  author: contentAuthorSchema.nullable(),
  categories: z.array(termSchema),
  tags: z.array(termSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type PostSummary = z.infer<typeof postSummarySchema>;

export const postDetailSchema = postSummarySchema.extend({
  content: z.string(),
});
export type PostDetail = z.infer<typeof postDetailSchema>;

export const postListSchema = z.object({
  items: z.array(postSummarySchema),
  total: z.number().int(),
  page: z.number().int(),
  perPage: z.number().int(),
});
export type PostList = z.infer<typeof postListSchema>;

export const pageDetailSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  content: z.string(),
  status: contentStatusSchema,
  author: contentAuthorSchema.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type PageDetail = z.infer<typeof pageDetailSchema>;
