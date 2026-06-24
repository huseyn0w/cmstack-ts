import type {
  AdminComment,
  AdminCommentList,
  AdminCommentListQuery,
  CommentThread,
  CreateCommentInput,
  ModerateCommentInput,
} from '@cmstack-ts/config';
import {
  type AdminCommentRow,
  COMMENT_REPOSITORY,
  type CommentRepository,
  POST_REPOSITORY,
  type PostRepository,
} from '@cmstack-ts/db';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { RecaptchaService } from '../spam/recaptcha.service';
import { buildCommentThread } from './thread';

@Injectable()
export class CommentsService {
  constructor(
    @Inject(POST_REPOSITORY) private readonly posts: PostRepository,
    @Inject(COMMENT_REPOSITORY) private readonly comments: CommentRepository,
    private readonly recaptcha: RecaptchaService,
  ) {}

  /** Public submission. New comments are PENDING until an editor approves them. */
  async submit(slug: string, input: CreateCommentInput): Promise<{ status: 'PENDING' }> {
    const passed = await this.recaptcha.verify(input.recaptchaToken);
    if (!passed) {
      throw new BadRequestException('Spam check failed. Please try again.');
    }

    const postId = await this.posts.findPublishedIdBySlug(slug);
    if (!postId) throw new NotFoundException('Post not found.');

    if (input.parentId) {
      // Only allow replies to an already-approved comment on the same post.
      const parent = await this.comments.findApprovedById(input.parentId, postId);
      if (!parent) throw new BadRequestException('Invalid parent comment.');
    }

    await this.comments.create({
      postId,
      parentId: input.parentId ?? null,
      authorName: input.authorName,
      authorEmail: input.authorEmail,
      content: input.content,
      status: 'PENDING',
    });

    return { status: 'PENDING' };
  }

  /** Public threaded read: only APPROVED comments for a published post. */
  async listForPost(slug: string): Promise<CommentThread> {
    const postId = await this.posts.findPublishedIdBySlug(slug);
    if (!postId) throw new NotFoundException('Post not found.');

    const rows = await this.comments.listApprovedForPost(postId);

    const items = buildCommentThread(
      rows.map((r) => ({
        id: r.id,
        parentId: r.parentId,
        authorName: r.authorName,
        content: r.content,
        createdAt: r.createdAt.toISOString(),
      })),
    );
    return { items, total: rows.length };
  }

  // --- Admin moderation ------------------------------------------------------

  async list(query: AdminCommentListQuery): Promise<AdminCommentList> {
    const { items, total } = await this.comments.listAndCount({
      status: query.status,
      page: query.page,
      perPage: query.perPage,
    });

    return {
      items: items.map((r) => this.toAdmin(r)),
      total,
      page: query.page,
      perPage: query.perPage,
    };
  }

  async moderate(id: string, input: ModerateCommentInput): Promise<AdminComment> {
    await this.ensureExists(id);
    const row = await this.comments.updateStatus(id, input.status);
    return this.toAdmin(row);
  }

  async remove(id: string): Promise<void> {
    await this.ensureExists(id);
    await this.comments.hardDelete(id);
  }

  private async ensureExists(id: string): Promise<void> {
    if (!(await this.comments.exists(id))) throw new NotFoundException('Comment not found.');
  }

  private toAdmin(row: AdminCommentRow): AdminComment {
    return {
      id: row.id,
      postSlug: row.post.slug,
      postTitle: row.post.title,
      parentId: row.parentId,
      authorName: row.authorName,
      authorEmail: row.authorEmail,
      content: row.content,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
