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
};

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
