import type { PostSummary } from '@typress/config';
import Link from 'next/link';

export function EditorialBlogIndex({ posts }: { posts: PostSummary[] }) {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '4rem 1.5rem' }}>
      <p
        style={{
          margin: 0,
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
          fontSize: 12,
          color: 'var(--accent)',
        }}
      >
        Typress
      </p>
      <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', margin: '0.75rem 0 2.5rem' }}>Blog</h1>

      {posts.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>No published posts yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {posts.map((post) => (
            <li
              key={post.id}
              style={{ padding: '1.5rem 0', borderBottom: '1px solid var(--line)' }}
            >
              <Link
                href={`/blog/${post.slug}`}
                style={{ textDecoration: 'none', color: 'var(--fg)' }}
              >
                <h2 style={{ fontSize: 22, margin: '0 0 0.4rem' }}>{post.title}</h2>
              </Link>
              {post.excerpt && (
                <p style={{ color: 'var(--muted)', margin: '0 0 0.6rem' }}>{post.excerpt}</p>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {post.categories.map((c) => (
                  <span key={c.id} style={{ fontSize: 12, color: 'var(--accent)' }}>
                    {c.name}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
