import { Link } from '@/i18n/navigation';
import type { PostSummary } from '@cmstack-ts/config';
import { getFormatter, getTranslations } from 'next-intl/server';

/**
 * "Related posts" block shown under a blog post. Theme-agnostic: styled with the
 * active theme's CSS variables (--fg/--muted/--accent/--line) like the other
 * shared blog components, so it renders coherently in editorial and magazine.
 */
export async function RelatedPosts({ posts }: { posts: PostSummary[] }) {
  if (posts.length === 0) return null;
  const t = await getTranslations('post');
  const format = await getFormatter();

  return (
    <section
      aria-label={t('related')}
      style={{ marginTop: '4rem', paddingTop: '2.5rem', borderTop: '1px solid var(--line)' }}
    >
      <h2
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--muted)',
          margin: '0 0 1.5rem',
        }}
      >
        {t('related')}
      </h2>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '1.75rem' }}>
        {posts.map((post) => {
          const published = post.publishedAt ? new Date(post.publishedAt) : null;
          return (
            <li key={post.id}>
              <article>
                {post.categories.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.4rem' }}>
                    {post.categories.slice(0, 2).map((c) => (
                      <span
                        key={c.id}
                        style={{
                          fontSize: 11,
                          color: 'var(--accent)',
                          textTransform: 'uppercase',
                          fontFamily: 'var(--font-mono)',
                          letterSpacing: '0.08em',
                        }}
                      >
                        {c.name}
                      </span>
                    ))}
                  </div>
                )}
                <h3 style={{ fontSize: '1.25rem', lineHeight: 1.2, margin: '0 0 0.4rem' }}>
                  <Link
                    href={`/blog/${post.slug}`}
                    style={{ color: 'var(--fg)', textDecoration: 'none' }}
                  >
                    {post.title}
                  </Link>
                </h3>
                {post.excerpt && (
                  <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 0.4rem' }}>
                    {post.excerpt}
                  </p>
                )}
                {published && (
                  <time
                    dateTime={post.publishedAt ?? undefined}
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: 'var(--muted)',
                    }}
                  >
                    {format.dateTime(published, { dateStyle: 'medium' })}
                  </time>
                )}
              </article>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
