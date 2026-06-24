import { describe, expect, it } from 'vitest';
import { localizeContent } from './localize';

describe('localizeContent', () => {
  it('overlays non-null translated fields and falls back per field', () => {
    const base = { title: 'EN', excerpt: 'e', content: 'c' };
    const translation = { title: 'DE', excerpt: null, content: undefined };
    expect(localizeContent(base, translation, ['title', 'excerpt', 'content'])).toEqual({
      title: 'DE',
      excerpt: 'e',
      content: 'c',
    });
  });

  it('returns the base verbatim when the translation is null', () => {
    const base = { title: 'EN', content: 'c' };
    expect(localizeContent(base, null, ['title', 'content'])).toEqual(base);
  });

  it('only overlays the listed fields', () => {
    const base = { title: 'EN', metaTitle: 'm' };
    const translation = { title: 'DE', metaTitle: 'M' };
    expect(localizeContent(base, translation, ['title'])).toEqual({ title: 'DE', metaTitle: 'm' });
  });
});
