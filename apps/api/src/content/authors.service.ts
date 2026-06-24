import { type AuthorProfile, DEFAULT_LOCALE } from '@cmstack-ts/config';
import { USER_REPOSITORY, type UserRepository } from '@cmstack-ts/db';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PostsService } from './posts.service';

@Injectable()
export class AuthorsService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly posts: PostsService,
  ) {}

  /** Public author profile: identity + their published posts (localized). */
  async getProfile(id: string, locale: string = DEFAULT_LOCALE): Promise<AuthorProfile> {
    const user = await this.users.findPublicProfile(id);
    if (!user) throw new NotFoundException('Author not found.');

    const posts = await this.posts.publicByAuthor(id, locale);
    return { id: user.id, name: user.name, image: user.image, bio: user.bio, posts };
  }
}
