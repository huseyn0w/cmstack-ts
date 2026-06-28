import { routing } from '@/i18n/routing';
import { siteUrl } from '@/lib/seo/site';
import type { Metadata } from 'next';
import { languageAlternates, localizedUrl } from './alternates';

/**
 * Build `metadata.alternates` for a locale-agnostic path: a per-locale canonical
 * plus the full `hreflang` languages map (incl. `x-default`). Absolute URLs are
 * used so they are correct regardless of the request's locale prefix.
 */
export function alternatesFor(locale: string, path: string): NonNullable<Metadata['alternates']> {
  const opts = {
    locales: routing.locales,
    defaultLocale: routing.defaultLocale,
    baseUrl: siteUrl,
  };
  return {
    canonical: localizedUrl(locale, path, opts),
    languages: languageAlternates(path, opts),
    // Feed auto-discovery, site-wide. Next replaces (not merges) the whole
    // `alternates` object per route, so the feed links must live here — every
    // public page builds its alternates through this helper.
    types: {
      'application/rss+xml': [{ url: `${siteUrl}/feed.xml`, title: 'RSS' }],
      'application/atom+xml': [{ url: `${siteUrl}/atom.xml`, title: 'Atom' }],
    },
  };
}
