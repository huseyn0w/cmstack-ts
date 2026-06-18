import { getSeoContent } from '@/lib/seo/fetch';
import { siteUrl } from '@/lib/seo/site';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const { profile } = await getSeoContent();
  const title = profile.tagline
    ? `${profile.organizationName} — ${profile.tagline}`
    : profile.organizationName;
  const description = profile.description || 'A WordPress-style CMS built entirely in TypeScript.';

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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${GeistSans.variable} ${GeistMono.variable}`}>{children}</body>
    </html>
  );
}
