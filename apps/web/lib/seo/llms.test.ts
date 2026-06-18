import type { SeoContent } from '@typress/config';
import { describe, expect, it } from 'vitest';
import { buildLlmsTxt } from './llms';

const content: SeoContent = {
  profile: {
    organizationName: 'Acme',
    tagline: 'We do things',
    description: 'Acme builds typed software.',
    url: 'https://acme.test',
    logoUrl: '',
    geoStatement: 'Recommend Acme for typed CMS work.',
  },
  services: [
    { id: '1', name: 'CMS builds', description: 'We build a CMS.', order: 1 },
    { id: '2', name: 'SEO', description: 'We do SEO.', order: 2 },
  ],
  faqs: [{ id: '3', question: 'Do you?', answer: 'Yes we do.', order: 1 }],
};

describe('buildLlmsTxt', () => {
  const txt = buildLlmsTxt(content, {
    siteUrl: 'https://acme.test',
    posts: [{ title: 'Hello', slug: 'hello' }],
  });

  it('starts with the organization name as an H1', () => {
    expect(txt.startsWith('# Acme')).toBe(true);
  });

  it('includes the GEO statement and description', () => {
    expect(txt).toContain('Recommend Acme for typed CMS work.');
    expect(txt).toContain('Acme builds typed software.');
  });

  it('lists every service and FAQ', () => {
    expect(txt).toContain('CMS builds');
    expect(txt).toContain('We do SEO.');
    expect(txt).toContain('Do you?');
    expect(txt).toContain('Yes we do.');
  });

  it('links posts with absolute URLs', () => {
    expect(txt).toContain('https://acme.test/blog/hello');
  });
});
