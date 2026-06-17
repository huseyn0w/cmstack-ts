import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  type PageDetail,
  type PostDetail,
  type PostList,
  type PostListQuery,
  postListQuerySchema,
} from '@typress/config';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PagesService } from './pages.service';
import { PostsService } from './posts.service';

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
  ): Promise<PostList> {
    return this.posts.list(query, { publicOnly: true });
  }

  @Get('posts/:slug')
  getPost(@Param('slug') slug: string): Promise<PostDetail> {
    return this.posts.findPublicBySlug(slug);
  }

  @Get('pages/:slug')
  getPage(@Param('slug') slug: string): Promise<PageDetail> {
    return this.pages.findPublicBySlug(slug);
  }
}
