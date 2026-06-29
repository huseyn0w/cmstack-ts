import { Prisma, type PrismaClient } from '@prisma/client';

export interface SearchRow {
  id: string;
  type: 'post' | 'page';
  title: string;
  slug: string;
  excerpt: string | null;
  publishedAt: Date | null;
}

/**
 * Postgres full-text search over published posts AND pages, scoped to the active
 * locale: when `locale` is given the searchable document + returned title/excerpt
 * use the per-locale translation overlaid on the base (LEFT JOIN + coalesce), so a
 * de search matches de text and falls back per-field to the base. noindex content
 * is excluded (a discovery surface). The user query is ALWAYS a bound `${rawQuery}`
 * parameter inside `Prisma.sql` (never interpolated); the english tsvector config is
 * used for every locale (per-language stemmers are intentionally out of scope).
 */
export interface SearchRepository {
  search(
    rawQuery: string,
    locale: string | undefined,
    limit: number,
    offset: number,
  ): Promise<SearchRow[]>;
  count(rawQuery: string, locale: string | undefined): Promise<number>;
}

export const SEARCH_REPOSITORY = Symbol('SEARCH_REPOSITORY');

export class PrismaSearchRepository implements SearchRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private tsquery(rawQuery: string): Prisma.Sql {
    return Prisma.sql`websearch_to_tsquery('english', ${rawQuery})`;
  }

  /** Post sub-select: localized title/excerpt/content when `locale` is set. */
  private postSelect(tsquery: Prisma.Sql, locale: string | undefined): Prisma.Sql {
    const join = locale
      ? Prisma.sql`LEFT JOIN "PostTranslation" pt ON pt."postId" = p."id" AND pt."locale" = ${locale}`
      : Prisma.empty;
    const title = locale ? Prisma.sql`coalesce(pt."title", p."title")` : Prisma.sql`p."title"`;
    const excerpt = locale
      ? Prisma.sql`coalesce(pt."excerpt", p."excerpt")`
      : Prisma.sql`p."excerpt"`;
    const content = locale
      ? Prisma.sql`coalesce(pt."content", p."content")`
      : Prisma.sql`p."content"`;
    const doc = Prisma.sql`to_tsvector('english', coalesce(${title},'') || ' ' || coalesce(${excerpt},'') || ' ' || coalesce(${content},''))`;
    return Prisma.sql`
      SELECT p."id" AS id, 'post' AS type, ${title} AS title, p."slug" AS slug,
             ${excerpt} AS excerpt, p."publishedAt" AS "publishedAt",
             ts_rank(${doc}, ${tsquery}) AS rank
      FROM "Post" p
      ${join}
      WHERE p."status" = 'PUBLISHED' AND p."deletedAt" IS NULL AND p."noindex" = false
        AND ${doc} @@ ${tsquery}
    `;
  }

  /** Page sub-select: pages have no excerpt, so excerpt is NULL and publishedAt is NULL. */
  private pageSelect(tsquery: Prisma.Sql, locale: string | undefined): Prisma.Sql {
    const join = locale
      ? Prisma.sql`LEFT JOIN "PageTranslation" pgt ON pgt."pageId" = pg."id" AND pgt."locale" = ${locale}`
      : Prisma.empty;
    const title = locale ? Prisma.sql`coalesce(pgt."title", pg."title")` : Prisma.sql`pg."title"`;
    const content = locale
      ? Prisma.sql`coalesce(pgt."content", pg."content")`
      : Prisma.sql`pg."content"`;
    const doc = Prisma.sql`to_tsvector('english', coalesce(${title},'') || ' ' || coalesce(${content},''))`;
    return Prisma.sql`
      SELECT pg."id" AS id, 'page' AS type, ${title} AS title, pg."slug" AS slug,
             NULL::text AS excerpt, NULL::timestamp AS "publishedAt",
             ts_rank(${doc}, ${tsquery}) AS rank
      FROM "Page" pg
      ${join}
      WHERE pg."status" = 'PUBLISHED' AND pg."deletedAt" IS NULL AND pg."noindex" = false
        AND ${doc} @@ ${tsquery}
    `;
  }

  private union(rawQuery: string, locale: string | undefined): Prisma.Sql {
    const tsquery = this.tsquery(rawQuery);
    return Prisma.sql`${this.postSelect(tsquery, locale)} UNION ALL ${this.pageSelect(tsquery, locale)}`;
  }

  search(
    rawQuery: string,
    locale: string | undefined,
    limit: number,
    offset: number,
  ): Promise<SearchRow[]> {
    return this.prisma.$queryRaw<SearchRow[]>(Prisma.sql`
      SELECT id, type, title, slug, excerpt, "publishedAt"
      FROM (${this.union(rawQuery, locale)}) results
      ORDER BY rank DESC, "publishedAt" DESC NULLS LAST
      LIMIT ${limit} OFFSET ${offset}
    `);
  }

  async count(rawQuery: string, locale: string | undefined): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT count(*) AS count FROM (${this.union(rawQuery, locale)}) results
    `);
    return Number(rows[0]?.count ?? 0);
  }
}
