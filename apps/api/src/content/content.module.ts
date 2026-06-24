import {
  CATEGORY_REPOSITORY,
  POST_LIKE_REPOSITORY,
  POST_REPOSITORY,
  PrismaCategoryRepository,
  PrismaPostLikeRepository,
  PrismaPostRepository,
  PrismaTagRepository,
  TAG_REPOSITORY,
} from '@cmstack-ts/db';
import { Module } from '@nestjs/common';
import { AccountsModule } from '../auth/accounts.module';
import { provideRepository } from '../persistence/repository.providers';
import { PluginsModule } from '../plugins/plugins.module';
import { AuthorsService } from './authors.service';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { HtmlSanitizerService } from './html-sanitizer.service';
import { LikesController, PublicLikesController } from './likes.controller';
import { LikesService } from './likes.service';
import { PagesController } from './pages.controller';
import { PagesService } from './pages.service';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { PublicAuthorsController } from './public-authors.controller';
import { PublicContentController } from './public-content.controller';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';

@Module({
  // AccountsModule provides the JwtAuthGuard/PoliciesGuard (and their deps) used
  // to protect the authoring controllers below. PluginsModule provides the
  // HookRegistry the post service uses to run content filters / emit events.
  imports: [AccountsModule, PluginsModule],
  controllers: [
    PostsController,
    PagesController,
    CategoriesController,
    TagsController,
    PublicContentController,
    SearchController,
    PublicAuthorsController,
    LikesController,
    PublicLikesController,
  ],
  providers: [
    PostsService,
    PagesService,
    CategoriesService,
    TagsService,
    HtmlSanitizerService,
    SearchService,
    AuthorsService,
    LikesService,
    provideRepository(TAG_REPOSITORY, PrismaTagRepository),
    provideRepository(CATEGORY_REPOSITORY, PrismaCategoryRepository),
    provideRepository(POST_REPOSITORY, PrismaPostRepository),
    provideRepository(POST_LIKE_REPOSITORY, PrismaPostLikeRepository),
  ],
})
export class ContentModule {}
