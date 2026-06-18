import Link from 'next/link';

export function EditorialHome() {
  return (
    <section style={{ display: 'grid', placeItems: 'center', padding: '6rem 2rem' }}>
      <div style={{ maxWidth: 640, textAlign: 'center' }}>
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
        <h1 style={{ fontSize: 'clamp(2rem, 6vw, 3.5rem)', lineHeight: 1.05, margin: '1rem 0' }}>
          A WordPress-style CMS, built entirely in TypeScript.
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 18, margin: '0 0 2rem' }}>
          Light, fast, SEO-first, and easy to read, understand, and extend.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <Link
            href="/blog"
            style={{
              display: 'inline-block',
              padding: '0.7rem 1.4rem',
              border: '1px solid var(--line)',
              borderRadius: 999,
              color: 'var(--fg)',
              textDecoration: 'none',
            }}
          >
            Read the blog →
          </Link>
          <Link
            href="/health"
            style={{
              display: 'inline-block',
              padding: '0.7rem 1.4rem',
              color: 'var(--muted)',
              textDecoration: 'none',
            }}
          >
            System status
          </Link>
        </div>
      </div>
    </section>
  );
}
