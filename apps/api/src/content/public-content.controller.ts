import {
  DEFAULT_LOCALE,
  type PageDetail,
  type PostDetail,
  type PostList,
  type PostListQuery,
  type PostSummary,
  localeSchema,
  postListQuerySchema,
} from '@cmstack-ts/config';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PagesService } from './pages.service';
import { PostsService } from './posts.service';

/** Resolve a `?locale=` query value, defaulting to the default locale on junk/absent. */
function resolveLocale(value?: string): string {
  return localeSchema.catch(DEFAULT_LOCALE).parse(value);
}

/**
 * Public, unauthenticated read API for the server-rendered site. Only published,
 * non-trashed content is ever returned.
 */
@Controller('public')
export class PublicContentController {
  constructor(
    private readonly posts: PostsService,
    private readonly pages: PagesService,
  ) {}

  @Get('posts')
  listPosts(
    @Query(new ZodValidationPipe(postListQuerySchema)) query: PostListQuery,
    @Query('locale') locale?: string,
  ): Promise<PostList> {
    return this.posts.list(query, { publicOnly: true }, resolveLocale(locale));
  }

  @Get('posts/:slug')
  getPost(@Param('slug') slug: string, @Query('locale') locale?: string): Promise<PostDetail> {
    return this.posts.findPublicBySlug(slug, resolveLocale(locale));
  }

  @Get('posts/:slug/related')
  getRelated(
    @Param('slug') slug: string,
    @Query('locale') locale?: string,
    @Query('limit') limit?: string,
  ): Promise<PostSummary[]> {
    return this.posts.findRelated(slug, resolveLocale(locale), Number(limit) || 3);
  }

  @Get('pages/:slug')
  getPage(@Param('slug') slug: string, @Query('locale') locale?: string): Promise<PageDetail> {
    return this.pages.findPublicBySlug(slug, resolveLocale(locale));
  }
}
