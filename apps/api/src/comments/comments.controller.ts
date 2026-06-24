import {
  type AdminComment,
  type AdminCommentList,
  type AdminCommentListQuery,
  type ModerateCommentInput,
  adminCommentListQuerySchema,
  moderateCommentSchema,
} from '@cmstack-ts/config';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckPolicies } from '../authz/check-policies.decorator';
import { PoliciesGuard } from '../authz/policies.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CommentsService } from './comments.service';

/** Admin comment moderation. Gated by the `Comment` subject (Editor + Admin). */
@Controller('comments')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get()
  @CheckPolicies((a) => a.can('read', 'Comment'))
  list(
    @Query(new ZodValidationPipe(adminCommentListQuerySchema)) query: AdminCommentListQuery,
  ): Promise<AdminCommentList> {
    return this.comments.list(query);
  }

  @Patch(':id')
  @CheckPolicies((a) => a.can('update', 'Comment'))
  moderate(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(moderateCommentSchema)) body: ModerateCommentInput,
  ): Promise<AdminComment> {
    return this.comments.moderate(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @CheckPolicies((a) => a.can('delete', 'Comment'))
  async remove(@Param('id') id: string): Promise<void> {
    await this.comments.remove(id);
  }
}
