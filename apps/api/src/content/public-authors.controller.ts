import { type AuthorProfile, DEFAULT_LOCALE, localeSchema } from '@cmstack-ts/config';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { AuthorsService } from './authors.service';

/** Public author profiles (identity + their published posts). */
@Controller('public/authors')
export class PublicAuthorsController {
  constructor(private readonly authors: AuthorsService) {}

  @Get(':id')
  getProfile(@Param('id') id: string, @Query('locale') locale?: string): Promise<AuthorProfile> {
    return this.authors.getProfile(id, localeSchema.catch(DEFAULT_LOCALE).parse(locale));
  }
}
