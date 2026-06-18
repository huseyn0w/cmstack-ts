import Link from 'next/link';

export function MagazineHome() {
  return (
    <section
      style={{ maxWidth: 820, margin: '0 auto', padding: '4rem 1.5rem', textAlign: 'center' }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 12,
          letterSpacing: '0.35em',
          textTransform: 'uppercase',
          color: 'var(--accent)',
          fontFamily: 'var(--font-sans)',
        }}
      >
        Vol. 1 · The Front Page
      </p>
      <h1
        style={{
          fontSize: 'clamp(2.5rem, 7vw, 4.5rem)',
          lineHeight: 1.04,
          margin: '1.25rem 0',
          fontWeight: 700,
        }}
      >
        A WordPress-style CMS, set entirely in TypeScript.
      </h1>
      <p
        style={{
          color: 'var(--muted)',
          fontSize: 20,
          lineHeight: 1.6,
          margin: '0 auto 2rem',
          maxWidth: 600,
          fontStyle: 'italic',
        }}
      >
        Light, fast, SEO-first — and a pleasure to read, understand, and extend.
      </p>
      <Link
        href="/blog"
        style={{
          display: 'inline-block',
          padding: '0.7rem 1.6rem',
          background: 'var(--accent)',
          color: '#fff',
          textDecoration: 'none',
          fontFamily: 'var(--font-sans)',
          fontSize: 13,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        Read the latest
      </Link>
    </section>
  );
}
