import type { Faq, Service, SiteProfile } from '@typress/config';

/**
 * Pure JSON-LD builders (schema.org). They return plain serializable objects so
 * they can be unit-tested and injected via a <script type="application/ld+json">.
 */

const SCHEMA = 'https://schema.org';

export interface OrganizationNode {
  '@context': string;
  '@type': 'Organization';
  name: string;
  url?: string;
  description?: string;
  logo?: string;
  slogan?: string;
}

export function organizationJsonLd(profile: SiteProfile, siteUrl: string): OrganizationNode {
  const node: OrganizationNode = {
    '@context': SCHEMA,
    '@type': 'Organization',
    name: profile.organizationName,
    url: profile.url || siteUrl,
  };
  if (profile.description) node.description = profile.description;
  if (profile.tagline) node.slogan = profile.tagline;
  if (profile.logoUrl) node.logo = profile.logoUrl;
  return node;
}

export interface WebSiteNode {
  '@context': string;
  '@type': 'WebSite';
  name: string;
  url: string;
}

export function webSiteJsonLd(profile: SiteProfile, siteUrl: string): WebSiteNode {
  return {
    '@context': SCHEMA,
    '@type': 'WebSite',
    name: profile.organizationName,
    url: profile.url || siteUrl,
  };
}

interface ServiceItem {
  '@type': 'Service';
  name: string;
  description?: string;
  provider: { '@type': 'Organization'; name: string };
}

export interface ServiceListNode {
  '@context': string;
  '@type': 'ItemList';
  itemListElement: { '@type': 'ListItem'; position: number; item: ServiceItem }[];
}

export function servicesJsonLd(services: Service[], profile: SiteProfile): ServiceListNode {
  return {
    '@context': SCHEMA,
    '@type': 'ItemList',
    itemListElement: services.map((service, i) => {
      const item: ServiceItem = {
        '@type': 'Service',
        name: service.name,
        provider: { '@type': 'Organization', name: profile.organizationName },
      };
      if (service.description) item.description = service.description;
      return { '@type': 'ListItem', position: i + 1, item };
    }),
  };
}

interface QuestionNode {
  '@type': 'Question';
  name: string;
  acceptedAnswer: { '@type': 'Answer'; text: string };
}

export interface FaqPageNode {
  '@context': string;
  '@type': 'FAQPage';
  mainEntity: QuestionNode[];
}

export function faqPageJsonLd(faqs: Faq[]): FaqPageNode {
  return {
    '@context': SCHEMA,
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };
}

export interface BlogPostingInput {
  title: string;
  slug: string;
  excerpt: string | null;
  publishedAt: string | null;
  authorName: string | null;
}

export interface BlogPostingNode {
  '@context': string;
  '@type': 'BlogPosting';
  headline: string;
  url: string;
  description?: string;
  datePublished?: string;
  author?: { '@type': 'Person'; name: string };
  publisher: { '@type': 'Organization'; name: string };
}

export function blogPostingJsonLd(
  post: BlogPostingInput,
  profile: SiteProfile,
  siteUrl: string,
): BlogPostingNode {
  const node: BlogPostingNode = {
    '@context': SCHEMA,
    '@type': 'BlogPosting',
    headline: post.title,
    url: `${siteUrl}/blog/${post.slug}`,
    publisher: { '@type': 'Organization', name: profile.organizationName },
  };
  if (post.excerpt) node.description = post.excerpt;
  if (post.publishedAt) node.datePublished = post.publishedAt;
  if (post.authorName) node.author = { '@type': 'Person', name: post.authorName };
  return node;
}
