/**
 * Convert arbitrary text into a URL-friendly slug: lowercased, diacritics
 * stripped, runs of non-alphanumerics collapsed to single hyphens, trimmed.
 * Returns 'untitled' if nothing usable remains.
 */
export function slugify(input: string): string {
  const base = input
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200)
    .replace(/-+$/g, '');
  return base.length > 0 ? base : 'untitled';
}
