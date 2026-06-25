'use client';

import { GoogleAnalytics, GoogleTagManager } from '@next/third-parties/google';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

type Consent = 'undecided' | 'accepted' | 'declined';

const COOKIE = 'ts-consent';

function persist(value: Consent) {
  // 1 year, site-wide; SSR reads this on the next navigation to avoid a banner flash.
  document.cookie = `${COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * Consent-gated analytics. Renders nothing until the visitor accepts; only then
 * are the GA4 / GTM scripts injected. The measurement ids are settings-driven
 * (empty = disabled). The initial consent value comes from the server (cookie)
 * so an already-decided visitor never sees a flash of the banner.
 */
export function AnalyticsLoader({
  gaId,
  gtmId,
  initialConsent,
}: {
  gaId: string;
  gtmId: string;
  initialConsent: Consent;
}) {
  const t = useTranslations('consent');
  const [consent, setConsent] = useState<Consent>(initialConsent);

  if (consent === 'accepted') {
    return (
      <>
        {gaId ? <GoogleAnalytics gaId={gaId} /> : null}
        {gtmId ? <GoogleTagManager gtmId={gtmId} /> : null}
      </>
    );
  }
  if (consent === 'declined') return null;
  // Nothing configured → nothing to consent to.
  if (!gaId && !gtmId) return null;

  function decide(value: Consent) {
    persist(value);
    setConsent(value);
  }

  return (
    <aside
      aria-label="Cookie consent"
      className="ts-consent fixed inset-x-0 bottom-0 z-50 flex flex-col gap-3 border-t border-[var(--line)] bg-[var(--bg)] p-4 text-sm text-[var(--fg)] sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="max-w-2xl">{t('message')}</p>
      <div className="flex gap-2">
        <button type="button" onClick={() => decide('declined')} className="ts-consent-btn">
          {t('decline')}
        </button>
        <button
          type="button"
          onClick={() => decide('accepted')}
          className="ts-consent-btn ts-consent-accept"
        >
          {t('accept')}
        </button>
      </div>
    </aside>
  );
}
