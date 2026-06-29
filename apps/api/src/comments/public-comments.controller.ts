import {
  type CommentThread,
  type CreateCommentInput,
  type EditCommentInput,
  createCommentSchema,
  editCommentSchema,
} from '@cmstack-ts/config';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { type CommentViewer, CommentsService } from './comments.service';

/** Map an authenticated request user to the comment viewer shape. */
function viewerOf(user: AuthenticatedUser | undefined): CommentViewer | undefined {
  return user ? { id: user.id, name: user.name, email: user.email } : undefined;
}

/**
 * Public comments for a published post. Reads return APPROVED comments (plus the
 * signed-in viewer's own); submission is rate-limited and spam-checked for guests;
 * signed-in authors may edit/delete their own comment within the edit window.
 */
@Controller('public/posts/:slug/comments')
export class PublicCommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  list(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ): Promise<CommentThread> {
    return this.comments.listForPost(slug, user?.id);
  }

  @Post()
  @UseGuards(OptionalJwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  submit(
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(createCommentSchema)) body: CreateCommentInput,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ): Promise<{ status: 'PENDING' }> {
    return this.comments.submit(slug, body, viewerOf(user));
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  edit(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(editCommentSchema)) body: EditCommentInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ status: 'PENDING' }> {
    return this.comments.editOwn(id, viewerOf(user) as CommentViewer, body.content);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.comments.deleteOwn(id, viewerOf(user) as CommentViewer);
  }
}
