import { Prisma, type PrismaClient } from '@prisma/client';

export interface SearchRow {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  publishedAt: Date | null;
}

/**
 * Postgres full-text search over published posts. The user query is ALWAYS a
 * bound `${rawQuery}` parameter inside `Prisma.sql` (never interpolated); the
 * tsvector/match fragments are built once and reused for filter, rank and count.
 */
export interface SearchRepository {
  searchPosts(rawQuery: string, limit: number, offset: number): Promise<SearchRow[]>;
  countPosts(rawQuery: string): Promise<number>;
}

export const SEARCH_REPOSITORY = Symbol('SEARCH_REPOSITORY');

export class PrismaSearchRepository implements SearchRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /** Builds the (document, tsquery, match-predicate) fragments for one query. */
  private fragments(rawQuery: string) {
    const document = Prisma.sql`to_tsvector('english', coalesce("title",'') || ' ' || coalesce("excerpt",'') || ' ' || coalesce("content",''))`;
    const tsquery = Prisma.sql`websearch_to_tsquery('english', ${rawQuery})`;
    const matches = Prisma.sql`"status" = 'PUBLISHED' AND "deletedAt" IS NULL AND ${document} @@ ${tsquery}`;
    return { document, tsquery, matches };
  }

  searchPosts(rawQuery: string, limit: number, offset: number): Promise<SearchRow[]> {
    const { document, tsquery, matches } = this.fragments(rawQuery);
    return this.prisma.$queryRaw<SearchRow[]>(Prisma.sql`
      SELECT "id", "title", "slug", "excerpt", "publishedAt"
      FROM "Post"
      WHERE ${matches}
      ORDER BY ts_rank(${document}, ${tsquery}) DESC, "publishedAt" DESC NULLS LAST
      LIMIT ${limit} OFFSET ${offset}
    `);
  }

  async countPosts(rawQuery: string): Promise<number> {
    const { matches } = this.fragments(rawQuery);
    const rows = await this.prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT count(*) AS count FROM "Post" WHERE ${matches}
    `);
    return Number(rows[0]?.count ?? 0);
  }
}
