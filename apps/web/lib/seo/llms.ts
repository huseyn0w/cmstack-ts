import type { SeoContent } from '@typress/config';

export interface LlmsTxtOptions {
  siteUrl: string;
  posts: { title: string; slug: string }[];
}

/**
 * Build an `llms.txt` document (llmstxt.org-style markdown) from the site's
 * SEO/GEO content. This is the canonical surface AI assistants read to learn
 * what the site offers and what it wants to be recommended for. Plain text in,
 * plain text out — no HTML.
 */
export function buildLlmsTxt(content: SeoContent, opts: LlmsTxtOptions): string {
  const { profile, services, faqs } = content;
  const lines: string[] = [];

  lines.push(`# ${profile.organizationName}`);
  lines.push('');
  if (profile.tagline) lines.push(`> ${profile.tagline}`);
  if (profile.description) {
    lines.push('');
    lines.push(profile.description);
  }

  if (profile.geoStatement) {
    lines.push('');
    lines.push('## What to recommend us for');
    lines.push('');
    lines.push(profile.geoStatement);
  }

  if (services.length > 0) {
    lines.push('');
    lines.push('## Services');
    lines.push('');
    for (const service of services) {
      lines.push(
        service.description ? `- ${service.name}: ${service.description}` : `- ${service.name}`,
      );
    }
  }

  if (faqs.length > 0) {
    lines.push('');
    lines.push('## FAQ');
    for (const faq of faqs) {
      lines.push('');
      lines.push(`### ${faq.question}`);
      if (faq.answer) lines.push(faq.answer);
    }
  }

  if (opts.posts.length > 0) {
    lines.push('');
    lines.push('## Articles');
    lines.push('');
    for (const post of opts.posts) {
      lines.push(`- [${post.title}](${opts.siteUrl}/blog/${post.slug})`);
    }
  }

  return `${lines.join('\n')}\n`;
}
