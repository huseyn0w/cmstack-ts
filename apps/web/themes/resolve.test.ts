import { describe, expect, it } from 'vitest';
import { resolveThemeId } from './resolve';

const known = ['editorial', 'magazine'] as const;

describe('resolveThemeId', () => {
  it('returns the requested id when it is a known theme', () => {
    expect(resolveThemeId('magazine', known, 'editorial')).toBe('magazine');
    expect(resolveThemeId('editorial', known, 'editorial')).toBe('editorial');
  });

  it('falls back to the default for an unknown theme id', () => {
    expect(resolveThemeId('does-not-exist', known, 'editorial')).toBe('editorial');
  });

  it('falls back to the default for empty/nullish values', () => {
    expect(resolveThemeId('', known, 'editorial')).toBe('editorial');
    expect(resolveThemeId(undefined, known, 'editorial')).toBe('editorial');
    expect(resolveThemeId(null, known, 'editorial')).toBe('editorial');
  });
});
