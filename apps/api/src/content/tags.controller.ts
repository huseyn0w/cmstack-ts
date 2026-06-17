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
import {
  type CreateTagInput,
  type UpdateTagInput,
  createTagSchema,
  updateTagSchema,
} from '@typress/config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckPolicies } from '../authz/check-policies.decorator';
import { PoliciesGuard } from '../authz/policies.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { type TagView, TagsService } from './tags.service';

@Controller('tags')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'Tag'))
  list(): Promise<TagView[]> {
    return this.tags.list();
  }

  @Get(':id')
  @CheckPolicies((ability) => ability.can('read', 'Tag'))
  findOne(@Param('id') id: string): Promise<TagView> {
    return this.tags.findById(id);
  }

  @Post()
  @CheckPolicies((ability) => ability.can('create', 'Tag'))
  create(@Body(new ZodValidationPipe(createTagSchema)) body: CreateTagInput): Promise<TagView> {
    return this.tags.create(body);
  }

  @Patch(':id')
  @CheckPolicies((ability) => ability.can('update', 'Tag'))
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateTagSchema)) body: UpdateTagInput,
  ): Promise<TagView> {
    return this.tags.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @CheckPolicies((ability) => ability.can('delete', 'Tag'))
  async remove(@Param('id') id: string): Promise<void> {
    await this.tags.remove(id);
  }
}
