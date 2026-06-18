import { siteUrl } from '@/lib/seo/site';
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    // Allow all crawlers (search engines and AI assistants such as GPTBot,
    // ClaudeBot, PerplexityBot) to read public content; keep private areas out.
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api', '/account', '/signin', '/signup'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
