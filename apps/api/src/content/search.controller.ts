import {
  DEFAULT_LOCALE,
  type SearchQuery,
  type SearchResponse,
  localeSchema,
  searchQuerySchema,
} from '@cmstack-ts/config';
import { Controller, Get, Query } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SearchService } from './search.service';

/** Resolve a `?locale=` query value, defaulting to the default locale on junk/absent. */
function resolveLocale(value?: string): string {
  return localeSchema.catch(DEFAULT_LOCALE).parse(value);
}

/** Public full-text search over published posts + pages, scoped to the active locale. */
@Controller('public/search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  run(
    @Query(new ZodValidationPipe(searchQuerySchema)) query: SearchQuery,
    @Query('locale') locale?: string,
  ): Promise<SearchResponse> {
    return this.search.search(query, resolveLocale(locale));
  }
}
