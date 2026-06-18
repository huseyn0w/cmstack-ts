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
      },
      services: [{ id: '1', name: 'S', description: '', order: 0 }],
      faqs: [{ id: '2', question: 'Q', answer: 'A', order: 0 }],
    });
    expect(value.services).toHaveLength(1);
    expect(value.faqs[0]?.question).toBe('Q');
  });
});
