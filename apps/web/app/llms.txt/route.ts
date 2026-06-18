import { getAllPublicPosts, getSeoContent } from '@/lib/seo/fetch';
import { buildLlmsTxt } from '@/lib/seo/llms';
import { siteUrl } from '@/lib/seo/site';

export const dynamic = 'force-dynamic';

/** Serves `/llms.txt` — the GEO feed AI assistants read to understand the site. */
export async function GET(): Promise<Response> {
  const [content, posts] = await Promise.all([getSeoContent(), getAllPublicPosts()]);
  const body = buildLlmsTxt(content, {
    siteUrl,
    posts: posts.map((p) => ({ title: p.title, slug: p.slug })),
  });

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
