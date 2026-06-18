import type { PostDetail } from '@typress/config';
import Link from 'next/link';

export function MagazineBlogPost({ post }: { post: PostDetail }) {
  const published = post.publishedAt ? new Date(post.publishedAt) : null;

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '3.5rem 1.5rem' }}>
      <article>
        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            justifyContent: 'center',
            fontFamily: 'var(--font-sans)',
            fontSize: 11,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--accent)',
            marginBottom: '1rem',
          }}
        >
          {post.categories.map((c) => (
            <span key={c.id}>{c.name}</span>
          ))}
        </div>
        <h1
          style={{
            fontSize: 'clamp(2.25rem, 6vw, 3.25rem)',
            lineHeight: 1.1,
            margin: '0 0 1rem',
            textAlign: 'center',
            fontWeight: 700,
          }}
        >
          {post.title}
        </h1>
        <p
          style={{
            color: 'var(--muted)',
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            textAlign: 'center',
            margin: '0 0 2.5rem',
            paddingBottom: '1.5rem',
            borderBottom: '3px double var(--line)',
          }}
        >
          By {post.author?.name ?? 'Unknown author'}
          {published && ` · ${published.toLocaleDateString('en-US', { dateStyle: 'long' })}`}
        </p>
        {/* content is sanitized server-side by the API before storage. */}
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: content is sanitized by the API. */}
        <div className="prose" dangerouslySetInnerHTML={{ __html: post.content }} />
      </article>

      <p style={{ marginTop: '3rem', textAlign: 'center', fontFamily: 'var(--font-sans)' }}>
        <Link href="/blog" style={{ color: 'var(--accent)', fontSize: 13, textDecoration: 'none' }}>
          ← All stories
        </Link>
      </p>
    </div>
  );
}
