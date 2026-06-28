import { getSeoContent } from '@/lib/seo/fetch';
import { siteUrl } from '@/lib/seo/site';
import { GeistMono } from 'geist/font/mono';
import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import { Inter, Newsreader } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

// Canonical design-system fonts (§3), self-hosted at build time by next/font
// (no runtime CDN): Inter for UI, Newsreader (serif) for display + prose, Geist
// Mono for metadata. font-display: swap + preload come for free.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});
const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-newsreader',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const { profile } = await getSeoContent();
  const title = profile.tagline
    ? `${profile.organizationName} — ${profile.tagline}`
    : profile.organizationName;
  const description = profile.description || 'A  CMS built entirely in TypeScript.';

  return {
    metadataBase: new URL(siteUrl),
    title: { default: title, template: `%s — ${profile.organizationName}` },
    description,
    openGraph: {
      type: 'website',
      siteName: profile.organizationName,
      url: siteUrl,
      title,
      description,
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  // The active locale is set by the next-intl middleware for public routes and
  // falls back to the default elsewhere (admin/account stay English).
  const locale = await getLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${inter.variable} ${newsreader.variable} ${GeistMono.variable} ${inter.className}`}
      >
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
