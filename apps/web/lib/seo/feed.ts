import type { SeoContent } from '@cmstack-ts/config';

/** A published post, reduced to the fields a syndication feed needs. */
export interface FeedPost {
  title: string;
  slug: string;
  excerpt: string | null;
  publishedAt: string | null; // ISO 8601
  updatedAt: string; // ISO 8601
  author: string | null;
}

export interface FeedOptions {
  siteUrl: string;
  posts: FeedPost[];
  /** Cap on the number of items emitted (newest first). Defaults to 50. */
  maxItems?: number;
}

const DEFAULT_MAX_ITEMS = 50;

/**
 * Escape a string for inclusion in XML text or a double-quoted attribute.
 * Mirrors the JSON-LD escaping guarantee: admin-editable fields (titles,
 * excerpts, author/org names) can't break out of the document. `&` must be
 * replaced first so the entities introduced below aren't double-escaped.
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** The date a feed entry is keyed on: publish time, falling back to last edit. */
function entryDate(post: FeedPost): string {
  return post.publishedAt ?? post.updatedAt;
}

/** Sort newest-first by entry date and cap the list. */
function orderedPosts(opts: FeedOptions): FeedPost[] {
  const max = opts.maxItems ?? DEFAULT_MAX_ITEMS;
  return [...opts.posts].sort((a, b) => entryDate(b).localeCompare(entryDate(a))).slice(0, max);
}

/** RFC-822 / RFC-1123 date as required by RSS `pubDate` (e.g. `toUTCString`). */
function toRfc822(iso: string): string {
  return new Date(iso).toUTCString();
}

function postUrl(siteUrl: string, slug: string): string {
  return `${siteUrl}/blog/${slug}`;
}

/** Build an RSS 2.0 document of the most recent published posts. */
export function buildRssFeed(content: SeoContent, opts: FeedOptions): string {
  const { profile } = content;
  const posts = orderedPosts(opts);
  const title = escapeXml(profile.organizationName);
  const description = escapeXml(profile.description || profile.tagline || profile.organizationName);
  const self = `${opts.siteUrl}/feed.xml`;

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(
    '<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">',
  );
  lines.push('  <channel>');
  lines.push(`    <title>${title}</title>`);
  lines.push(`    <link>${escapeXml(opts.siteUrl)}</link>`);
  lines.push(`    <description>${description}</description>`);
  lines.push(`    <atom:link href="${escapeXml(self)}" rel="self" type="application/rss+xml" />`);
  const newest = posts[0];
  if (newest) {
    lines.push(`    <lastBuildDate>${toRfc822(entryDate(newest))}</lastBuildDate>`);
  }

  for (const post of posts) {
    const url = postUrl(opts.siteUrl, post.slug);
    lines.push('    <item>');
    lines.push(`      <title>${escapeXml(post.title)}</title>`);
    lines.push(`      <link>${escapeXml(url)}</link>`);
    lines.push(`      <guid isPermaLink="true">${escapeXml(url)}</guid>`);
    lines.push(`      <pubDate>${toRfc822(entryDate(post))}</pubDate>`);
    if (post.author) lines.push(`      <dc:creator>${escapeXml(post.author)}</dc:creator>`);
    if (post.excerpt) lines.push(`      <description>${escapeXml(post.excerpt)}</description>`);
    lines.push('    </item>');
  }

  lines.push('  </channel>');
  lines.push('</rss>');
  return `${lines.join('\n')}\n`;
}

/** Build an Atom 1.0 document of the most recent published posts. */
export function buildAtomFeed(content: SeoContent, opts: FeedOptions): string {
  const { profile } = content;
  const posts = orderedPosts(opts);
  const title = escapeXml(profile.organizationName);
  const self = `${opts.siteUrl}/atom.xml`;
  // Atom requires a feed-level `updated`; key it off the newest entry, else the
  // site URL has no meaningful timestamp so fall back to the post-less case.
  const newest = posts[0];
  const updated = newest ? entryDate(newest) : null;

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<feed xmlns="http://www.w3.org/2005/Atom">');
  lines.push(`  <title>${title}</title>`);
  if (profile.description || profile.tagline) {
    lines.push(`  <subtitle>${escapeXml(profile.description || profile.tagline)}</subtitle>`);
  }
  lines.push(`  <id>${escapeXml(`${opts.siteUrl}/`)}</id>`);
  lines.push(`  <link href="${escapeXml(opts.siteUrl)}" />`);
  lines.push(`  <link rel="self" href="${escapeXml(self)}" type="application/atom+xml" />`);
  if (updated) lines.push(`  <updated>${escapeXml(updated)}</updated>`);
  // Feed-level author fallback so entries without an explicit author stay valid.
  lines.push(`  <author><name>${title}</name></author>`);

  for (const post of posts) {
    const url = postUrl(opts.siteUrl, post.slug);
    lines.push('  <entry>');
    lines.push(`    <title>${escapeXml(post.title)}</title>`);
    lines.push(`    <link href="${escapeXml(url)}" />`);
    lines.push(`    <id>${escapeXml(url)}</id>`);
    lines.push(`    <updated>${escapeXml(post.updatedAt)}</updated>`);
    if (post.publishedAt) lines.push(`    <published>${escapeXml(post.publishedAt)}</published>`);
    if (post.author) lines.push(`    <author><name>${escapeXml(post.author)}</name></author>`);
    if (post.excerpt) {
      lines.push(`    <summary type="text">${escapeXml(post.excerpt)}</summary>`);
    }
    lines.push('  </entry>');
  }

  lines.push('</feed>');
  return `${lines.join('\n')}\n`;
}
