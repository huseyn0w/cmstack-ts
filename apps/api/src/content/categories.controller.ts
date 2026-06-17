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
  type CreateCategoryInput,
  type UpdateCategoryInput,
  createCategorySchema,
  updateCategorySchema,
} from '@typress/config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckPolicies } from '../authz/check-policies.decorator';
import { PoliciesGuard } from '../authz/policies.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CategoriesService, type CategoryView } from './categories.service';

@Controller('categories')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'Category'))
  list(): Promise<CategoryView[]> {
    return this.categories.list();
  }

  @Get(':id')
  @CheckPolicies((ability) => ability.can('read', 'Category'))
  findOne(@Param('id') id: string): Promise<CategoryView> {
    return this.categories.findById(id);
  }

  @Post()
  @CheckPolicies((ability) => ability.can('create', 'Category'))
  create(
    @Body(new ZodValidationPipe(createCategorySchema)) body: CreateCategoryInput,
  ): Promise<CategoryView> {
    return this.categories.create(body);
  }

  @Patch(':id')
  @CheckPolicies((ability) => ability.can('update', 'Category'))
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCategorySchema)) body: UpdateCategoryInput,
  ): Promise<CategoryView> {
    return this.categories.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @CheckPolicies((ability) => ability.can('delete', 'Category'))
  async remove(@Param('id') id: string): Promise<void> {
    await this.categories.remove(id);
  }
}
