import type { Faq, Service, SiteProfile } from '@typress/config';
import { describe, expect, it } from 'vitest';
import { blogPostingJsonLd, faqPageJsonLd, organizationJsonLd, servicesJsonLd } from './jsonld';

const profile: SiteProfile = {
  organizationName: 'Acme',
  tagline: 'tag',
  description: 'desc',
  url: 'https://acme.test',
  logoUrl: 'https://acme.test/logo.png',
  geoStatement: 'geo',
};

describe('organizationJsonLd', () => {
  it('builds an Organization node with name, url and logo', () => {
    const node = organizationJsonLd(profile, 'https://acme.test');
    expect(node['@type']).toBe('Organization');
    expect(node.name).toBe('Acme');
    expect(node.url).toBe('https://acme.test');
    expect(node.logo).toBe('https://acme.test/logo.png');
  });

  it('omits the logo when none is set', () => {
    const node = organizationJsonLd({ ...profile, logoUrl: '' }, 'https://acme.test');
    expect('logo' in node).toBe(false);
  });
});

describe('servicesJsonLd', () => {
  it('builds an ItemList of Service nodes', () => {
    const services: Service[] = [{ id: '1', name: 'CMS', description: 'd', order: 1 }];
    const node = servicesJsonLd(services, profile);
    expect(node['@type']).toBe('ItemList');
    expect(node.itemListElement[0]?.item['@type']).toBe('Service');
    expect(node.itemListElement[0]?.item.name).toBe('CMS');
    expect(node.itemListElement[0]?.item.provider.name).toBe('Acme');
  });
});

describe('faqPageJsonLd', () => {
  it('builds a FAQPage with Question/Answer pairs', () => {
    const faqs: Faq[] = [{ id: '1', question: 'Q?', answer: 'A.', order: 1 }];
    const node = faqPageJsonLd(faqs);
    expect(node['@type']).toBe('FAQPage');
    expect(node.mainEntity[0]?.['@type']).toBe('Question');
    expect(node.mainEntity[0]?.name).toBe('Q?');
    expect(node.mainEntity[0]?.acceptedAnswer.text).toBe('A.');
  });
});

describe('blogPostingJsonLd', () => {
  it('builds a BlogPosting with headline, url and publisher', () => {
    const node = blogPostingJsonLd(
      {
        title: 'Hello',
        slug: 'hello',
        excerpt: 'hi',
        publishedAt: '2026-01-01T00:00:00.000Z',
        authorName: 'Jane',
      },
      profile,
      'https://acme.test',
    );
    expect(node['@type']).toBe('BlogPosting');
    expect(node.headline).toBe('Hello');
    expect(node.url).toBe('https://acme.test/blog/hello');
    expect(node.datePublished).toBe('2026-01-01T00:00:00.000Z');
    expect(node.author?.name).toBe('Jane');
    expect(node.publisher.name).toBe('Acme');
  });
});
