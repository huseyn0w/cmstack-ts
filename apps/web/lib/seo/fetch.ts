import 'server-only';

import { apiBaseUrl } from '@/app/lib/api';
import { type SeoContent, postListSchema, seoContentSchema } from '@typress/config';

const FALLBACK: SeoContent = {
  profile: {
    organizationName: 'Typress',
    tagline: '',
    description: '',
    url: '',
    logoUrl: '',
    geoStatement: '',
  },
  services: [],
  faqs: [],
};

/** Fetch the public SEO/GEO payload; degrade to a safe fallback if unreachable. */
export async function getSeoContent(): Promise<SeoContent> {
  try {
    const res = await fetch(`${apiBaseUrl}/public/seo`, { cache: 'no-store' });
    if (!res.ok) return FALLBACK;
    const parsed = seoContentSchema.safeParse(await res.json());
    return parsed.success ? parsed.data : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

export interface PublicPostRef {
  title: string;
  slug: string;
  updatedAt: string;
  publishedAt: string | null;
}

const PER_PAGE = 100;
const MAX_PAGES = 50; // safety bound: up to 5000 posts in the sitemap/llms feed.

/**
 * Fetch every published post (for sitemap + llms.txt), paging past the API's
 * per-request cap so large sites aren't silently truncated. Returns whatever was
 * gathered if the API fails partway.
 */
export async function getAllPublicPosts(): Promise<PublicPostRef[]> {
  const all: PublicPostRef[] = [];
  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await fetch(`${apiBaseUrl}/public/posts?perPage=${PER_PAGE}&page=${page}`, {
        cache: 'no-store',
      });
      if (!res.ok) break;
      const parsed = postListSchema.safeParse(await res.json());
      if (!parsed.success) break;
      const { items } = parsed.data;
      for (const p of items) {
        all.push({
          title: p.title,
          slug: p.slug,
          updatedAt: p.updatedAt,
          publishedAt: p.publishedAt,
        });
      }
      if (items.length < PER_PAGE) break;
    }
  } catch {
    // Network error mid-paging — return what we have rather than nothing.
  }
  return all;
}
