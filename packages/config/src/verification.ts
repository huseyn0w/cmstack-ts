import type { VerificationTag } from './seo';

/** The verification fields the builder reads off the site profile. */
export interface VerificationSource {
  googleSiteVerification: string;
  bingSiteVerification: string;
  yandexVerification: string;
  facebookDomainVerification: string;
  pinterestVerification: string;
  customVerificationTags: VerificationTag[];
}

export interface VerificationMeta {
  google?: string;
  yandex?: string;
  /** name → content for `<meta>` tags Next renders via `verification.other`. */
  other: Record<string, string>;
}

/**
 * Pure: turn a site profile's verification fields into a shape ready for Next's
 * `Metadata.verification`. Named fields take precedence over custom pairs that
 * reuse the same meta name; empty values and blank/duplicate custom names are
 * dropped. No HTML is produced here — Next escapes the rendered attributes.
 */
export function buildVerificationMeta(src: VerificationSource): VerificationMeta {
  const other: Record<string, string> = {};
  const put = (name: string, content: string) => {
    if (content) other[name] = content;
  };
  put('msvalidate.01', src.bingSiteVerification);
  put('facebook-domain-verification', src.facebookDomainVerification);
  put('p:domain_verify', src.pinterestVerification);
  for (const tag of src.customVerificationTags) {
    if (tag.name && tag.content && !(tag.name in other)) other[tag.name] = tag.content;
  }
  return {
    google: src.googleSiteVerification || undefined,
    yandex: src.yandexVerification || undefined,
    other,
  };
}
