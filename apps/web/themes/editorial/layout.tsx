import Link from 'next/link';
import type { ReactNode } from 'react';

/** Editorial theme chrome: dark, restrained, hairline rules. */
export function EditorialLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="theme-editorial"
      data-public-theme="editorial"
      style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        color: 'var(--fg)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1.25rem 2rem',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <Link
          href="/"
          style={{
            color: 'var(--fg)',
            textDecoration: 'none',
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            fontSize: 12,
          }}
        >
          Typress
        </Link>
        <nav style={{ display: 'flex', gap: '1.25rem', fontSize: 14 }}>
          <Link href="/blog" style={{ color: 'var(--muted)', textDecoration: 'none' }}>
            Blog
          </Link>
          <Link href="/services" style={{ color: 'var(--muted)', textDecoration: 'none' }}>
            Services
          </Link>
          <Link href="/signin" style={{ color: 'var(--muted)', textDecoration: 'none' }}>
            Sign in
          </Link>
          <Link href="/account" style={{ color: 'var(--fg)', textDecoration: 'none' }}>
            Account
          </Link>
        </nav>
      </header>

      <main style={{ flex: 1 }}>{children}</main>

      <footer
        style={{
          padding: '2rem',
          borderTop: '1px solid var(--line)',
          color: 'var(--muted)',
          fontSize: 12,
          letterSpacing: '0.04em',
          textAlign: 'center',
        }}
      >
        © {new Date().getFullYear()} Typress · Editorial theme
      </footer>
    </div>
  );
}
