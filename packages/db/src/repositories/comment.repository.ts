import { type CommentStatus, Prisma, type PrismaClient } from '@prisma/client';
import { PrismaCrudRepository } from './crud.repository';

const adminInclude = {
  post: { select: { slug: true, title: true } },
} satisfies Prisma.CommentInclude;

/** Admin comment row (with its post's slug/title) returned to moderators. */
export type AdminCommentRow = Prisma.CommentGetPayload<{ include: typeof adminInclude }>;

/** Public-safe flat comment row — author email is never selected. */
export type FlatCommentRow = {
  id: string;
  parentId: string | null;
  authorName: string;
  content: string;
  createdAt: Date;
};

export type CommentCreateData = {
  postId: string;
  parentId: string | null;
  authorName: string;
  authorEmail: string;
  content: string;
  status: CommentStatus;
  /** Set when an authenticated user authored the comment (enables self-edit). */
  userId?: string | null;
};

/** A comment the requesting user owns — for ownership + edit-window checks. */
export type OwnedCommentRow = {
  id: string;
  status: CommentStatus;
  createdAt: Date;
  post: { slug: string };
};

/** Own comment flattened for the threaded read (carries status for a pending hint). */
export type OwnFlatCommentRow = FlatCommentRow & { status: CommentStatus };

export type AdminCommentFilter = {
  status?: CommentStatus;
  page: number;
  perPage: number;
};

/** Data access for {@link Comment}. */
export interface CommentRepository {
  /** An APPROVED comment with this id on the given post (parent validation), or null. */
  findApprovedById(id: string, postId: string): Promise<{ id: string } | null>;
  /** Persist a comment and return it with its post's slug/title (for notifications). */
  create(data: CommentCreateData): Promise<AdminCommentRow>;
  /** APPROVED comments for a post, oldest first, WITHOUT author email. */
  listApprovedForPost(postId: string): Promise<FlatCommentRow[]>;
  /** The viewer's OWN comments for a post (PENDING + APPROVED), oldest first. */
  listOwnForPost(postId: string, userId: string): Promise<OwnFlatCommentRow[]>;
  /** A comment owned by `userId` (status/createdAt/post for window + revalidation), or null. */
  findOwnedById(id: string, userId: string): Promise<OwnedCommentRow | null>;
  /** Replace a comment's content and send it back to PENDING (re-moderation). */
  updateOwnContent(id: string, content: string): Promise<void>;
  listAndCount(filter: AdminCommentFilter): Promise<{ items: AdminCommentRow[]; total: number }>;
  exists(id: string): Promise<boolean>;
  updateStatus(id: string, status: CommentStatus): Promise<AdminCommentRow>;
  hardDelete(id: string): Promise<void>;
}

export const COMMENT_REPOSITORY = Symbol('COMMENT_REPOSITORY');

export class PrismaCommentRepository extends PrismaCrudRepository implements CommentRepository {
  constructor(private readonly prisma: PrismaClient) {
    super(prisma.comment);
  }

  findApprovedById(id: string, postId: string): Promise<{ id: string } | null> {
    return this.prisma.comment.findFirst({
      where: { id, postId, status: 'APPROVED' },
      select: { id: true },
    });
  }

  create(data: CommentCreateData): Promise<AdminCommentRow> {
    return this.prisma.comment.create({ data, include: adminInclude });
  }

  listApprovedForPost(postId: string): Promise<FlatCommentRow[]> {
    return this.prisma.comment.findMany({
      where: { postId, status: 'APPROVED' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, parentId: true, authorName: true, content: true, createdAt: true },
    });
  }

  listOwnForPost(postId: string, userId: string): Promise<OwnFlatCommentRow[]> {
    return this.prisma.comment.findMany({
      where: { postId, userId, status: { in: ['PENDING', 'APPROVED'] } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        parentId: true,
        authorName: true,
        content: true,
        createdAt: true,
        status: true,
      },
    });
  }

  findOwnedById(id: string, userId: string): Promise<OwnedCommentRow | null> {
    return this.prisma.comment.findFirst({
      where: { id, userId },
      select: { id: true, status: true, createdAt: true, post: { select: { slug: true } } },
    });
  }

  async updateOwnContent(id: string, content: string): Promise<void> {
    // Editing re-opens moderation: an approved comment returns to PENDING so an
    // author can't approve-then-swap to spam.
    await this.prisma.comment.update({ where: { id }, data: { content, status: 'PENDING' } });
  }

  async listAndCount(filter: AdminCommentFilter): Promise<{
    items: AdminCommentRow[];
    total: number;
  }> {
    const where: Prisma.CommentWhereInput = {};
    if (filter.status) where.status = filter.status;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.comment.findMany({
        where,
        include: adminInclude,
        orderBy: { createdAt: 'desc' },
        skip: (filter.page - 1) * filter.perPage,
        take: filter.perPage,
      }),
      this.prisma.comment.count({ where }),
    ]);
    return { items, total };
  }

  updateStatus(id: string, status: CommentStatus): Promise<AdminCommentRow> {
    return this.prisma.comment.update({ where: { id }, data: { status }, include: adminInclude });
  }
}
