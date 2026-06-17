import { postDetailSchema } from '@typress/config';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiBaseUrl } from '../../lib/api';

export const dynamic = 'force-dynamic';

async function getPost(slug: string) {
  try {
    const res = await fetch(`${apiBaseUrl}/public/posts/${encodeURIComponent(slug)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const parsed = postDetailSchema.safeParse(await res.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const published = post.publishedAt ? new Date(post.publishedAt) : null;

  return (
    <main style={{ maxWidth: 680, margin: '0 auto', padding: '4rem 1.5rem' }}>
      <article>
        <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem' }}>
          {post.categories.map((c) => (
            <span
              key={c.id}
              style={{ fontSize: 12, color: 'var(--accent)', textTransform: 'uppercase' }}
            >
              {c.name}
            </span>
          ))}
        </div>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', lineHeight: 1.1, margin: '0 0 1rem' }}>
          {post.title}
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 2.5rem' }}>
          {post.author?.name ?? 'Unknown author'}
          {published && ` · ${published.toLocaleDateString('en-US', { dateStyle: 'long' })}`}
        </p>
        {/* content is sanitized server-side by the API before storage. */}
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: content is sanitized by the API. */}
        <div className="prose" dangerouslySetInnerHTML={{ __html: post.content }} />
      </article>

      <p style={{ marginTop: '3rem' }}>
        <Link href="/blog" style={{ color: 'var(--muted)', fontSize: 13, textDecoration: 'none' }}>
          ← All posts
        </Link>
      </p>
    </main>
  );
}
