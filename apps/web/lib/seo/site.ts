const DEFAULT_SITE_URL = 'http://localhost:3000';

const configured = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.AUTH_URL ??
  DEFAULT_SITE_URL
).replace(/\/+$/, '');

/**
 * The public, canonical base URL of the site (no trailing slash). Used for
 * metadataBase, canonical URLs, sitemap, robots, llms.txt, and JSON-LD. A
 * malformed env value falls back to the default so it can't crash metadata
 * generation on every page.
 */
export const siteUrl = (() => {
  try {
    new URL(configured);
    return configured;
  } catch {
    return DEFAULT_SITE_URL;
  }
})();
