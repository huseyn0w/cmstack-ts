import Link from 'next/link';

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: '2rem',
      }}
    >
      <nav
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          padding: '1.25rem 2rem',
          display: 'flex',
          gap: '1.25rem',
          fontSize: 14,
        }}
      >
        <Link href="/signin" style={{ color: 'var(--muted)', textDecoration: 'none' }}>
          Sign in
        </Link>
        <Link href="/account" style={{ color: 'var(--fg)', textDecoration: 'none' }}>
          Account
        </Link>
      </nav>

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
        <Link
          href="/health"
          style={{
            display: 'inline-block',
            padding: '0.7rem 1.4rem',
            border: '1px solid var(--line)',
            borderRadius: 999,
            color: 'var(--fg)',
            textDecoration: 'none',
          }}
        >
          System status →
        </Link>
      </div>
    </main>
  );
}
