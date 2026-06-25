import { describe, expect, it } from 'vitest';
import {
  createFaqSchema,
  createServiceSchema,
  seoContentSchema,
  updateSiteProfileSchema,
} from './seo';

describe('updateSiteProfileSchema', () => {
  it('accepts a valid profile and allows empty optional urls', () => {
    const parsed = updateSiteProfileSchema.parse({
      organizationName: 'Acme',
      geoStatement: 'We build typed CMS software.',
    });
    expect(parsed.organizationName).toBe('Acme');
    expect(parsed.url).toBe('');
    expect(parsed.tagline).toBe('');
  });

  it('requires a non-empty organization name', () => {
    expect(() => updateSiteProfileSchema.parse({ organizationName: '' })).toThrow();
  });

  it('rejects a malformed url but accepts a valid one or empty', () => {
    expect(() =>
      updateSiteProfileSchema.parse({ organizationName: 'A', url: 'not-a-url' }),
    ).toThrow();
    expect(
      updateSiteProfileSchema.parse({ organizationName: 'A', url: 'https://acme.test' }).url,
    ).toBe('https://acme.test');
    expect(updateSiteProfileSchema.parse({ organizationName: 'A', url: '' }).url).toBe('');
  });
});

describe('updateSiteProfileSchema — analytics & verification', () => {
  const base = { organizationName: 'Acme' };

  it('accepts a valid GA4 and GTM id', () => {
    const p = updateSiteProfileSchema.parse({
      ...base,
      ga4MeasurementId: 'G-ABC123',
      gtmContainerId: 'GTM-XYZ99',
    });
    expect(p.ga4MeasurementId).toBe('G-ABC123');
    expect(p.gtmContainerId).toBe('GTM-XYZ99');
  });

  it('defaults the new fields to empty / []', () => {
    const p = updateSiteProfileSchema.parse(base);
    expect(p.ga4MeasurementId).toBe('');
    expect(p.gtmContainerId).toBe('');
    expect(p.googleSiteVerification).toBe('');
    expect(p.customVerificationTags).toEqual([]);
  });

  it('rejects a malformed GA4 id', () => {
    expect(() => updateSiteProfileSchema.parse({ ...base, ga4MeasurementId: 'UA-123' })).toThrow();
  });

  it('rejects a malformed GTM id', () => {
    expect(() => updateSiteProfileSchema.parse({ ...base, gtmContainerId: 'GTM_bad' })).toThrow();
  });

  it('rejects a verification token containing angle brackets', () => {
    expect(() =>
      updateSiteProfileSchema.parse({ ...base, googleSiteVerification: 'abc<script>' }),
    ).toThrow();
  });

  it('accepts custom verification pairs and rejects a blank name', () => {
    const p = updateSiteProfileSchema.parse({
      ...base,
      customVerificationTags: [{ name: 'p:domain_verify', content: 'token123' }],
    });
    expect(p.customVerificationTags).toHaveLength(1);
    expect(() =>
      updateSiteProfileSchema.parse({
        ...base,
        customVerificationTags: [{ name: '', content: 'x' }],
      }),
    ).toThrow();
  });

  it('caps the custom verification list at 20', () => {
    const many = Array.from({ length: 21 }, (_, i) => ({ name: `m${i}`, content: 'x' }));
    expect(() =>
      updateSiteProfileSchema.parse({ ...base, customVerificationTags: many }),
    ).toThrow();
  });
});

describe('createServiceSchema / createFaqSchema', () => {
  it('requires a name / question', () => {
    expect(() => createServiceSchema.parse({ name: '' })).toThrow();
    expect(() => createFaqSchema.parse({ question: '' })).toThrow();
  });

  it('defaults description/answer to empty string', () => {
    expect(createServiceSchema.parse({ name: 'SEO audits' }).description).toBe('');
    expect(createFaqSchema.parse({ question: 'Do you?' }).answer).toBe('');
  });
});

describe('seoContentSchema', () => {
  it('parses the public payload shape', () => {
    const value = seoContentSchema.parse({
      profile: {
        organizationName: 'Acme',
        tagline: 't',
        description: 'd',
        url: '',
        logoUrl: '',
        geoStatement: 'g',
        contactEmail: '',
        ga4MeasurementId: '',
        gtmContainerId: '',
        googleSiteVerification: '',
        bingSiteVerification: '',
        yandexVerification: '',
        facebookDomainVerification: '',
        pinterestVerification: '',
        customVerificationTags: [],
      },
      services: [{ id: '1', name: 'S', description: '', order: 0 }],
      faqs: [{ id: '2', question: 'Q', answer: 'A', order: 0 }],
    });
    expect(value.services).toHaveLength(1);
    expect(value.faqs[0]?.question).toBe('Q');
  });
});
