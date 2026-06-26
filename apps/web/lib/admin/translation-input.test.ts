import { describe, expect, it } from 'vitest';
import { buildTranslationInput, localeLabel } from './translation-input';

describe('buildTranslationInput', () => {
  it('keeps only non-empty, trimmed, allowed fields', () => {
    const out = buildTranslationInput(['title', 'content', 'metaTitle'], {
      title: '  Hallo  ',
      content: '',
      metaTitle: ' Meta ',
      excerpt: 'ignored — not allowed',
    });
    expect(out).toEqual({ title: 'Hallo', metaTitle: 'Meta' });
  });

  it('returns an empty object when every field is blank (clears the override)', () => {
    expect(buildTranslationInput(['title', 'content'], { title: '   ', content: '' })).toEqual({});
  });
});

describe('localeLabel', () => {
  it('renders a friendly name with the code', () => {
    expect(localeLabel('de')).toBe('Deutsch (de)');
    expect(localeLabel('ru')).toBe('Русский (ru)');
    expect(localeLabel('xx')).toBe('xx (xx)');
  });
});
