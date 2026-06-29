import {
  type AdminComment,
  type AdminCommentList,
  type AdminCommentListQuery,
  COMMENT_EDIT_WINDOW_MINUTES,
  type CommentThread,
  type CreateCommentInput,
  type ModerateCommentInput,
} from '@cmstack-ts/config';
import {
  type AdminCommentRow,
  COMMENT_REPOSITORY,
  type CommentRepository,
  POST_REPOSITORY,
  type PostRepository,
} from '@cmstack-ts/db';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HookRegistry } from '../plugins/hook-registry';
import { RecaptchaService } from '../spam/recaptcha.service';
import { type FlatComment, buildCommentThread } from './thread';

/** The signed-in author of a comment action (subset of the authenticated user). */
export interface CommentViewer {
  id: string;
  name: string | null;
  email: string;
}

const EDIT_WINDOW_MS = COMMENT_EDIT_WINDOW_MINUTES * 60_000;

@Injectable()
export class CommentsService {
  constructor(
    @Inject(POST_REPOSITORY) private readonly posts: PostRepository,
    @Inject(COMMENT_REPOSITORY) private readonly comments: CommentRepository,
    private readonly recaptcha: RecaptchaService,
    private readonly hooks: HookRegistry,
  ) {}

  /**
   * Public submission. New comments are PENDING until an editor approves them.
   * A signed-in `viewer` is attributed (userId set + name/email snapshotted from
   * the account), which enables self-edit; guests must supply name + email and
   * pass the spam check.
   */
  async submit(
    slug: string,
    input: CreateCommentInput,
    viewer?: CommentViewer,
  ): Promise<{ status: 'PENDING' }> {
    if (!viewer) {
      // Guests are spam-checked and must identify themselves.
      const passed = await this.recaptcha.verify(input.recaptchaToken);
      if (!passed) throw new BadRequestException('Spam check failed. Please try again.');
      if (!input.authorName || !input.authorEmail) {
        throw new BadRequestException('Name and email are required.');
      }
    }

    const postId = await this.posts.findPublishedIdBySlug(slug);
    if (!postId) throw new NotFoundException('Post not found.');

    if (input.parentId) {
      // Only allow replies to an already-approved comment on the same post.
      const parent = await this.comments.findApprovedById(input.parentId, postId);
      if (!parent) throw new BadRequestException('Invalid parent comment.');
    }

    // Signed-in authors are attributed; their display name/email are snapshotted
    // from the account (the request body's name/email are ignored).
    const authorName = viewer ? viewer.name?.trim() || 'Member' : (input.authorName as string);
    const authorEmail = viewer ? viewer.email : (input.authorEmail as string);

    const created = await this.comments.create({
      postId,
      parentId: input.parentId ?? null,
      authorName,
      authorEmail,
      content: input.content,
      status: 'PENDING',
      userId: viewer?.id ?? null,
    });

    // Side effect: notify the moderator. Fault-isolated — a mail failure can't
    // fail the already-stored comment or the public response (§2.7). The author
    // email is deliberately left out of the event payload (PII minimization).
    await this.hooks.emit('comment.submitted', {
      id: created.id,
      postSlug: created.post.slug,
      postTitle: created.post.title,
      authorName: created.authorName,
      content: created.content,
    });

    return { status: 'PENDING' };
  }

  /**
   * Public threaded read: APPROVED comments for a published post. When a signed-in
   * `viewerUserId` is given, that viewer's OWN comments (incl. PENDING) are merged
   * in and flagged `mine`/`pending` so they can edit them — others never see another
   * user's pending comments.
   */
  async listForPost(slug: string, viewerUserId?: string): Promise<CommentThread> {
    const postId = await this.posts.findPublishedIdBySlug(slug);
    if (!postId) throw new NotFoundException('Post not found.');

    const approved = await this.comments.listApprovedForPost(postId);
    const flat: FlatComment[] = approved.map((r) => ({
      id: r.id,
      parentId: r.parentId,
      authorName: r.authorName,
      content: r.content,
      createdAt: r.createdAt.toISOString(),
    }));
    // `total` counts only the public (approved) comments.
    const total = approved.length;

    if (viewerUserId) {
      const own = await this.comments.listOwnForPost(postId, viewerUserId);
      const seen = new Set(flat.map((c) => c.id));
      for (const r of own) {
        const node: FlatComment = {
          id: r.id,
          parentId: r.parentId,
          authorName: r.authorName,
          content: r.content,
          createdAt: r.createdAt.toISOString(),
          mine: true,
          pending: r.status === 'PENDING',
        };
        if (seen.has(r.id)) {
          // Already in the approved set — just flag it as the viewer's own.
          const existing = flat.find((c) => c.id === r.id);
          if (existing) existing.mine = true;
        } else {
          flat.push(node);
        }
      }
      // Keep chronological order after merging in pending own comments.
      flat.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }

    return { items: buildCommentThread(flat), total };
  }

  /** Edit your own comment within the window; re-opens moderation (back to PENDING). */
  async editOwn(
    id: string,
    viewer: CommentViewer,
    content: string,
  ): Promise<{ status: 'PENDING' }> {
    await this.requireOwnedWithinWindow(id, viewer.id);
    await this.comments.updateOwnContent(id, content);
    return { status: 'PENDING' };
  }

  /** Delete your own comment within the window (hard delete; replies cascade). */
  async deleteOwn(id: string, viewer: CommentViewer): Promise<void> {
    await this.requireOwnedWithinWindow(id, viewer.id);
    await this.comments.hardDelete(id);
  }

  /** Load a comment the viewer owns, asserting it is still within the edit window. */
  private async requireOwnedWithinWindow(id: string, userId: string) {
    const owned = await this.comments.findOwnedById(id, userId);
    if (!owned) throw new NotFoundException('Comment not found.');
    if (Date.now() - owned.createdAt.getTime() > EDIT_WINDOW_MS) {
      throw new ForbiddenException(
        `Comments can only be edited within ${COMMENT_EDIT_WINDOW_MINUTES} minutes of posting.`,
      );
    }
    return owned;
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
