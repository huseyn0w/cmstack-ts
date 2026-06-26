import { Logger } from '@nestjs/common';
import type { CmstackTsPlugin } from '../plugin.types';

const WORDS_PER_MINUTE = 200;
const BADGE_MARKER = 'data-plugin="reading-time"';

/** Estimate a whole-minute reading time from HTML content (min 1 minute). */
export function estimateReadingTimeMinutes(html: string): number {
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = text ? text.split(' ').length : 0;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

/**
 * Prepend a reading-time badge to post content. Idempotent: if a badge is
 * already present (e.g. the filter somehow ran twice) it is left untouched. The
 * injected markup is a fixed shape with only a computed integer interpolated, so
 * it stays safe to render alongside the API-sanitized content.
 */
export function withReadingTime(content: string): string {
  if (content.includes(BADGE_MARKER)) return content;
  const minutes = estimateReadingTimeMinutes(content);
  const badge = `<p class="reading-time" ${BADGE_MARKER}>${minutes} min read</p>`;
  return badge + content;
}

/**
 * Sample plugin. Demonstrates both hook kinds:
 *  - a **filter** that alters public post output (the reading-time badge),
 *  - an **action** listener that observes the `post.published` event.
 */
export const readingTimePlugin: CmstackTsPlugin = {
  id: 'reading-time',
  name: 'Reading time',
  description: 'Prepends an estimated reading-time badge to public post content.',
  register(api) {
    const logger = new Logger('plugin:reading-time');

    api.addFilter('public.post.render', (post) => ({
      ...post,
      content: withReadingTime(post.content),
    }));

    api.addAction('post.published', (payload) => {
      logger.log(`Post published: "${payload.title}" (${payload.slug})`);
    });
  },
};
