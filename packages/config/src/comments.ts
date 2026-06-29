import { z } from 'zod';

/**
 * Comment contracts (Phase 8). Guests comment with a name + email; signed-in
 * users have their name/email pre-filled. New comments start PENDING and are
 * shown publicly only once an editor APPROVES them. Content is plain text
 * (rendered escaped).
 */

export const commentStatusSchema = z.enum(['PENDING', 'APPROVED', 'SPAM', 'TRASH']);
export type CommentStatus = z.infer<typeof commentStatusSchema>;

export const createCommentSchema = z.object({
  // Optional: required for guests (enforced server-side), ignored for signed-in
  // users (their name/email are snapshotted from the account).
  authorName: z.string().trim().min(1).max(80).optional(),
  authorEmail: z.string().trim().email().max(200).optional(),
  content: z.string().trim().min(1).max(4000),
  /** Set to reply to another comment (threading). */
  parentId: z.string().min(1).optional(),
  /** reCAPTCHA v3 token; verified server-side when reCAPTCHA is configured. */
  recaptchaToken: z.string().optional(),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

/** Edit the content of your own comment (signed-in authors, within the window). */
export const editCommentSchema = z.object({
  content: z.string().trim().min(1).max(4000),
});
export type EditCommentInput = z.infer<typeof editCommentSchema>;

/**
 * How long after posting a signed-in author may edit or delete their own comment.
 * Shared by the API (enforcement) and the web (whether to show the controls).
 */
export const COMMENT_EDIT_WINDOW_MINUTES = 15;

export const moderateCommentSchema = z.object({
  status: commentStatusSchema,
});
export type ModerateCommentInput = z.infer<typeof moderateCommentSchema>;

// --- Public threaded output --------------------------------------------------

export interface CommentNode {
  id: string;
  authorName: string;
  content: string;
  createdAt: string;
  /** True when this comment belongs to the requesting (signed-in) viewer. */
  mine?: boolean;
  /** True when this (own) comment is awaiting moderation. */
  pending?: boolean;
  replies: CommentNode[];
}

export const commentNodeSchema: z.ZodType<CommentNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    authorName: z.string(),
    content: z.string(),
    createdAt: z.string(),
    mine: z.boolean().optional(),
    pending: z.boolean().optional(),
    replies: z.array(commentNodeSchema),
  }),
);

export const commentThreadSchema = z.object({
  items: z.array(commentNodeSchema),
  total: z.number().int(),
});
export type CommentThread = z.infer<typeof commentThreadSchema>;

// --- Admin moderation output -------------------------------------------------

export const adminCommentSchema = z.object({
  id: z.string(),
  postSlug: z.string(),
  postTitle: z.string(),
  parentId: z.string().nullable(),
  authorName: z.string(),
  authorEmail: z.string(),
  content: z.string(),
  status: commentStatusSchema,
  createdAt: z.string().datetime(),
});
export type AdminComment = z.infer<typeof adminCommentSchema>;

export const adminCommentListQuerySchema = z.object({
  status: commentStatusSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
});
export type AdminCommentListQuery = z.infer<typeof adminCommentListQuerySchema>;

export const adminCommentListSchema = z.object({
  items: z.array(adminCommentSchema),
  total: z.number().int(),
  page: z.number().int(),
  perPage: z.number().int(),
});
export type AdminCommentList = z.infer<typeof adminCommentListSchema>;
