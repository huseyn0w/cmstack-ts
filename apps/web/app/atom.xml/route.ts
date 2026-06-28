import { type FeedPost, buildAtomFeed } from '@/lib/seo/feed';
import { getAllPublicPosts, getSeoContent } from '@/lib/seo/fetch';
import { siteUrl } from '@/lib/seo/site';

export const dynamic = 'force-dynamic';

/** Serves `/atom.xml` — an Atom 1.0 feed of the most recent published posts. */
export async function GET(): Promise<Response> {
  const [content, posts] = await Promise.all([getSeoContent(), getAllPublicPosts()]);
  // noindex posts are kept out of the feed too (consistent with the sitemap/llms).
  const feedPosts: FeedPost[] = posts
    .filter((p) => !p.noindex)
    .map((p) => ({
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      publishedAt: p.publishedAt,
      updatedAt: p.updatedAt,
      author: p.author,
    }));
  const body = buildAtomFeed(content, { siteUrl, posts: feedPosts });

  return new Response(body, {
    headers: { 'Content-Type': 'application/atom+xml; charset=utf-8' },
  });
}
