import {
  DEFAULT_LOCALE,
  type SearchQuery,
  type SearchResponse,
  type SearchResult,
} from '@cmstack-ts/config';
import { SEARCH_REPOSITORY, type SearchRepository, type SearchRow } from '@cmstack-ts/db';
import { Inject, Injectable } from '@nestjs/common';

/**
 * Postgres full-text search over published posts + pages, scoped to the active
 * locale. The data access (parameterized `$queryRaw` with the per-locale overlay)
 * lives in {@link SearchRepository}; this service owns pagination math, locale
 * resolution, and response shaping.
 */
@Injectable()
export class SearchService {
  constructor(@Inject(SEARCH_REPOSITORY) private readonly searchRepo: SearchRepository) {}

  async search(query: SearchQuery, locale: string = DEFAULT_LOCALE): Promise<SearchResponse> {
    const { q, page, perPage } = query;
    const offset = (page - 1) * perPage;
    // Default locale searches the base columns (no translation overlay).
    const overlay = locale === DEFAULT_LOCALE ? undefined : locale;

    const [rows, total] = await Promise.all([
      this.searchRepo.search(q, overlay, perPage, offset),
      this.searchRepo.count(q, overlay),
    ]);

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
      type: row.type,
      title: row.title,
      slug: row.slug,
      excerpt: row.excerpt,
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    };
  }
}
