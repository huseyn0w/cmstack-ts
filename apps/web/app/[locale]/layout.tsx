import { AnalyticsLoader } from '@/components/public/analytics-loader';
import { routing } from '@/i18n/routing';
import { getSeoContent } from '@/lib/seo/fetch';
import { buildVerificationMeta } from '@cmstack-ts/config';
import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * Locale segment for the public site. Validates the locale, enables the
 * locale-aware rendering context, and defers the `<html>`/`<body>` shell to the
 * single root layout (which reads the active locale via `getLocale()`).
 */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * Search-engine / platform site-verification meta tags — public pages only.
 * Next merges this with the root layout's metadata; admin/auth (app root) never
 * see these tags. Tokens are settings-driven and Next escapes the attributes.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { profile } = await getSeoContent();
  const v = buildVerificationMeta(profile);
  return {
    verification: {
      ...(v.google ? { google: v.google } : {}),
      ...(v.yandex ? { yandex: v.yandex } : {}),
      ...(Object.keys(v.other).length ? { other: v.other } : {}),
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const { profile } = await getSeoContent();
  const consentCookie = (await cookies()).get('ts-consent')?.value;
  const initialConsent =
    consentCookie === 'accepted' || consentCookie === 'declined' ? consentCookie : 'undecided';

  return (
    <>
      {children}
      <AnalyticsLoader
        gaId={profile.ga4MeasurementId}
        gtmId={profile.gtmContainerId}
        initialConsent={initialConsent}
      />
    </>
  );
}
