import { apiBaseUrl } from '@/app/lib/api';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { localizedPath } from '@/lib/i18n/alternates';
import { alternatesFor } from '@/lib/i18n/metadata';
import { getActiveTheme } from '@/themes/active-theme';
import { searchResponseSchema } from '@cmstack-ts/config';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('search');
  return { title: t('title'), alternates: alternatesFor(locale, '/search') };
}

async function runSearch(q: string, locale: string) {
  if (!q) return null;
  try {
    const res = await fetch(
      `${apiBaseUrl}/public/search?q=${encodeURIComponent(q)}&locale=${encodeURIComponent(locale)}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    const parsed = searchResponseSchema.safeParse(await res.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  const { q = '' } = await searchParams;
  const query = q.trim();
  const t = await getTranslations('search');
  const [{ Layout }, results] = await Promise.all([getActiveTheme(), runSearch(query, locale)]);
  // Keep the form on the active locale's search path (no prefix for the default).
  const action = localizedPath(locale, '/search', routing.defaultLocale);

  return (
    <Layout>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '4rem 1.5rem' }}>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', margin: '0 0 1.5rem' }}>{t('title')}</h1>

        <form action={action} method="get" style={{ display: 'flex', gap: '0.6rem' }}>
          <input
            name="q"
            defaultValue={query}
            placeholder={t('placeholder')}
            aria-label={t('inputLabel')}
            style={{
              flex: 1,
              padding: '0.7rem 0.9rem',
              background: 'transparent',
              border: '1px solid var(--line)',
              borderRadius: 8,
              color: 'var(--fg)',
              fontSize: 15,
            }}
          />
          <button
            type="submit"
            style={{
              padding: '0.7rem 1.4rem',
              border: '1px solid var(--line)',
              borderRadius: 8,
              background: 'var(--fg)',
              color: 'var(--bg)',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            {t('submit')}
          </button>
        </form>

        {query && (
          <div style={{ marginTop: '2.5rem' }}>
            {!results || results.items.length === 0 ? (
              <p style={{ color: 'var(--muted)' }}>{t('noResults', { query })}</p>
            ) : (
              <>
                <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 1.5rem' }}>
                  {t('results', { count: results.total, query })}
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {results.items.map((item) => (
                    <li
                      key={item.id}
                      style={{ padding: '1.25rem 0', borderBottom: '1px solid var(--line)' }}
                    >
                      <Link
                        href={item.type === 'page' ? `/${item.slug}` : `/blog/${item.slug}`}
                        style={{ color: 'var(--fg)', textDecoration: 'none' }}
                      >
                        <h2 style={{ fontSize: 20, margin: '0 0 0.3rem' }}>{item.title}</h2>
                      </Link>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 11,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          color: 'var(--muted)',
                        }}
                      >
                        {t(item.type === 'page' ? 'typePage' : 'typePost')}
                      </span>
                      {item.excerpt && (
                        <p style={{ color: 'var(--muted)', margin: '0.3rem 0 0', fontSize: 15 }}>
                          {item.excerpt}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
