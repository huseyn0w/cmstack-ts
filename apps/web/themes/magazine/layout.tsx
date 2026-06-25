import { LocaleSwitcher } from '@/components/i18n/locale-switcher';
import { SiteMenu } from '@/components/public/site-menu';
import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

export const MAGAZINE_SERIF = 'Georgia, "Times New Roman", Times, serif';

/** Magazine theme chrome: light, serif masthead with double rules. */
export async function MagazineLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('nav');
  const ts = await getTranslations('site');
  const tf = await getTranslations('footer');

  return (
    <div
      className="theme-magazine"
      data-public-theme="magazine"
      style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        color: 'var(--fg)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: MAGAZINE_SERIF,
      }}
    >
      <header style={{ borderBottom: '3px double var(--line)', textAlign: 'center' }}>
        <div style={{ padding: '2rem 1.5rem 1.25rem' }}>
          <Link
            href="/"
            style={{
              color: 'var(--fg)',
              textDecoration: 'none',
              fontSize: 'clamp(2rem, 6vw, 3rem)',
              letterSpacing: '0.06em',
              fontWeight: 700,
            }}
          >
            Cmstack-TS
          </Link>
          <p
            style={{
              margin: '0.4rem 0 0',
              fontSize: 12,
              letterSpacing: '0.35em',
              textTransform: 'uppercase',
              color: 'var(--muted)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {ts('masthead')}
          </p>
        </div>
        <nav
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '1.75rem',
            padding: '0.6rem',
            borderTop: '1px solid var(--line)',
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          <SiteMenu
            location="primary"
            fallback={
              <>
                <Link href="/blog" style={{ color: 'var(--fg)', textDecoration: 'none' }}>
                  {t('blog')}
                </Link>
                <Link href="/services" style={{ color: 'var(--fg)', textDecoration: 'none' }}>
                  {t('services')}
                </Link>
                <Link href="/search" style={{ color: 'var(--fg)', textDecoration: 'none' }}>
                  {t('search')}
                </Link>
              </>
            }
          />
          <Link href="/signin" style={{ color: 'var(--muted)', textDecoration: 'none' }}>
            {t('signIn')}
          </Link>
          <Link href="/account" style={{ color: 'var(--muted)', textDecoration: 'none' }}>
            {t('account')}
          </Link>
          <LocaleSwitcher />
        </nav>
      </header>

      <main style={{ flex: 1 }}>{children}</main>

      <footer
        style={{
          padding: '2rem',
          borderTop: '3px double var(--line)',
          color: 'var(--muted)',
          fontSize: 12,
          letterSpacing: '0.04em',
          textAlign: 'center',
          fontFamily: 'var(--font-sans)',
        }}
      >
        © {new Date().getFullYear()} Cmstack-TS · {tf('magazine')}
      </footer>
    </div>
  );
}
