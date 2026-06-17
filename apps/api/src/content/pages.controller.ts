import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  type CreatePageInput,
  type PageDetail,
  type UpdatePageInput,
  createPageSchema,
  updatePageSchema,
} from '@typress/config';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckPolicies } from '../authz/check-policies.decorator';
import { PoliciesGuard } from '../authz/policies.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PagesService } from './pages.service';
import type { RevisionView } from './posts.service';

@Controller('pages')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class PagesController {
  constructor(private readonly pages: PagesService) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'Page'))
  list(@Query('includeTrashed') includeTrashed?: string): Promise<PageDetail[]> {
    return this.pages.list({ includeTrashed: includeTrashed === 'true' });
  }

  @Get(':id')
  @CheckPolicies((ability) => ability.can('read', 'Page'))
  findOne(@Param('id') id: string): Promise<PageDetail> {
    return this.pages.findById(id);
  }

  @Get(':id/revisions')
  @CheckPolicies((ability) => ability.can('read', 'Page'))
  revisions(@Param('id') id: string): Promise<RevisionView[]> {
    return this.pages.revisions(id);
  }

  @Post()
  @CheckPolicies((ability) => ability.can('create', 'Page'))
  create(
    @Body(new ZodValidationPipe(createPageSchema)) body: CreatePageInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PageDetail> {
    return this.pages.create(body, user.id);
  }

  @Patch(':id')
  @CheckPolicies((ability) => ability.can('update', 'Page'))
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updatePageSchema)) body: UpdatePageInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PageDetail> {
    return this.pages.update(id, body, user.id);
  }

  @Delete(':id')
  @HttpCode(204)
  @CheckPolicies((ability) => ability.can('delete', 'Page'))
  async remove(@Param('id') id: string): Promise<void> {
    await this.pages.softDelete(id);
  }

  @Post(':id/restore')
  @CheckPolicies((ability) => ability.can('update', 'Page'))
  restore(@Param('id') id: string): Promise<PageDetail> {
    return this.pages.restore(id);
  }

  @Delete(':id/permanent')
  @HttpCode(204)
  @CheckPolicies((ability) => ability.can('delete', 'Page'))
  async destroy(@Param('id') id: string): Promise<void> {
    await this.pages.destroy(id);
  }
}
