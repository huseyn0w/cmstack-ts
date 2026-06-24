import type { SearchQuery, SearchResponse, SearchResult } from '@cmstack-ts/config';
import { SEARCH_REPOSITORY, type SearchRepository, type SearchRow } from '@cmstack-ts/db';
import { Inject, Injectable } from '@nestjs/common';

/**
 * Postgres full-text search over published posts. The data access (parameterized
 * `$queryRaw`) lives in {@link SearchRepository}; this service owns pagination math
 * and response shaping.
 */
@Injectable()
export class SearchService {
  constructor(@Inject(SEARCH_REPOSITORY) private readonly searchRepo: SearchRepository) {}

  async search(query: SearchQuery): Promise<SearchResponse> {
    const { q, page, perPage } = query;
    const offset = (page - 1) * perPage;

    const rows = await this.searchRepo.searchPosts(q, perPage, offset);
    const total = await this.searchRepo.countPosts(q);

    return {
      query: q,
      items: rows.map((r) => this.toResult(r)),
      total,
      page,
      perPage,
    };
  }

  private toResult(row: SearchRow): SearchResult {
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      excerpt: row.excerpt,
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    };
  }
}
