import type { SeoContent } from '@cmstack-ts/config';
import { describe, expect, it } from 'vitest';
import { type FeedPost, buildAtomFeed, buildRssFeed } from './feed';

const content: SeoContent = {
  profile: {
    organizationName: 'Acme & Co',
    tagline: 'We do <things>',
    description: 'Acme builds typed software.',
    url: 'https://acme.test',
    logoUrl: '',
    geoStatement: '',
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
  services: [],
  faqs: [],
};

const posts: FeedPost[] = [
  {
    title: 'Older post',
    slug: 'older',
    excerpt: 'An older excerpt.',
    publishedAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-02T10:00:00.000Z',
    author: 'Jane Doe',
  },
  {
    title: 'Newer & <special>',
    slug: 'newer',
    excerpt: null,
    publishedAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-01T10:00:00.000Z',
    author: null,
  },
];

const opts = { siteUrl: 'https://acme.test', posts };

describe('buildRssFeed', () => {
  const xml = buildRssFeed(content, opts);

  it('is a well-formed RSS 2.0 document', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain('<channel>');
    expect(xml).toContain('</rss>');
  });

  it('uses the organization as the channel title and the site URL as the link', () => {
    expect(xml).toContain('<title>Acme &amp; Co</title>');
    expect(xml).toContain('<link>https://acme.test</link>');
  });

  it('advertises a self link to the feed', () => {
    expect(xml).toContain('href="https://acme.test/feed.xml"');
  });

  it('emits an item per post with an absolute permalink guid', () => {
    expect(xml).toContain('<guid isPermaLink="true">https://acme.test/blog/newer</guid>');
    expect(xml).toContain('<link>https://acme.test/blog/older</link>');
  });

  it('XML-escapes every dynamic field', () => {
    expect(xml).toContain('<title>Newer &amp; &lt;special&gt;</title>');
    expect(xml).not.toContain('<special>');
    expect(xml).not.toContain('Acme & Co');
  });

  it('formats pubDate as an RFC-822 date', () => {
    expect(xml).toContain('<pubDate>Mon, 01 Jun 2026 10:00:00 GMT</pubDate>');
  });

  it('orders items newest-first', () => {
    expect(xml.indexOf('https://acme.test/blog/newer')).toBeLessThan(
      xml.indexOf('https://acme.test/blog/older'),
    );
  });

  it('includes the author as a dc:creator only when present', () => {
    expect(xml).toContain('xmlns:dc="http://purl.org/dc/elements/1.1/"');
    expect(xml).toContain('<dc:creator>Jane Doe</dc:creator>');
    // The author-less post must not emit an empty creator element.
    expect(xml).not.toContain('<dc:creator></dc:creator>');
  });

  it('emits a description only when the post has an excerpt', () => {
    expect(xml).toContain('<description>An older excerpt.</description>');
    expect((xml.match(/<description>/g) ?? []).length).toBe(2); // channel + one post
  });

  it('caps the number of items', () => {
    const many: FeedPost[] = Array.from({ length: 60 }, (_, i) => ({
      title: `Post ${i}`,
      slug: `post-${i}`,
      excerpt: null,
      publishedAt: `2026-01-01T00:00:${String(i % 60).padStart(2, '0')}.000Z`,
      updatedAt: '2026-01-01T00:00:00.000Z',
      author: null,
    }));
    const capped = buildRssFeed(content, {
      siteUrl: 'https://acme.test',
      posts: many,
      maxItems: 50,
    });
    expect((capped.match(/<item>/g) ?? []).length).toBe(50);
  });
});

describe('buildAtomFeed', () => {
  const xml = buildAtomFeed(content, opts);

  it('is a well-formed Atom 1.0 document', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<feed xmlns="http://www.w3.org/2005/Atom">');
    expect(xml).toContain('</feed>');
  });

  it('has a feed id, self link and updated timestamp', () => {
    expect(xml).toContain('<id>https://acme.test/</id>');
    expect(xml).toContain('rel="self" href="https://acme.test/atom.xml"');
    expect(xml).toContain('<updated>2026-06-01T10:00:00.000Z</updated>');
  });

  it('emits an entry per post with an id, updated and published date', () => {
    expect(xml).toContain('<id>https://acme.test/blog/newer</id>');
    expect(xml).toContain('<published>2026-01-01T10:00:00.000Z</published>');
  });

  it('XML-escapes entry titles and uses a feed-level author fallback', () => {
    expect(xml).toContain('<title>Newer &amp; &lt;special&gt;</title>');
    expect(xml).toContain('<name>Acme &amp; Co</name>');
    expect(xml).toContain('<name>Jane Doe</name>');
  });
});
