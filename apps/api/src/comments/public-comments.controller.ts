import {
  type CommentThread,
  type CreateCommentInput,
  createCommentSchema,
} from '@cmstack-ts/config';
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CommentsService } from './comments.service';

/**
 * Public comments for a published post. Reads return only APPROVED comments;
 * submission is rate-limited and spam-checked, and lands in the moderation queue.
 */
@Controller('public/posts/:slug/comments')
export class PublicCommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get()
  list(@Param('slug') slug: string): Promise<CommentThread> {
    return this.comments.listForPost(slug);
  }

  @Post()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  submit(
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(createCommentSchema)) body: CreateCommentInput,
  ): Promise<{ status: 'PENDING' }> {
    return this.comments.submit(slug, body);
  }
}
