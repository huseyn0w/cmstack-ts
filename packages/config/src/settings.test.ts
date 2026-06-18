import { describe, expect, it } from 'vitest';
import { themeSettingSchema, updateThemeSettingSchema } from './settings';

describe('updateThemeSettingSchema', () => {
  it('accepts a slug-shaped theme id', () => {
    expect(updateThemeSettingSchema.parse({ activeTheme: 'editorial' })).toEqual({
      activeTheme: 'editorial',
    });
    expect(updateThemeSettingSchema.parse({ activeTheme: 'magazine' }).activeTheme).toBe(
      'magazine',
    );
  });

  it('rejects empty, uppercase, or path-like values', () => {
    expect(() => updateThemeSettingSchema.parse({ activeTheme: '' })).toThrow();
    expect(() => updateThemeSettingSchema.parse({ activeTheme: 'Editorial' })).toThrow();
    expect(() => updateThemeSettingSchema.parse({ activeTheme: '../etc/passwd' })).toThrow();
    expect(() => updateThemeSettingSchema.parse({ activeTheme: 'a b' })).toThrow();
  });

  it('rejects a missing activeTheme', () => {
    expect(() => updateThemeSettingSchema.parse({})).toThrow();
  });
});

describe('themeSettingSchema', () => {
  it('parses an active-theme response', () => {
    expect(themeSettingSchema.parse({ activeTheme: 'magazine' })).toEqual({
      activeTheme: 'magazine',
    });
  });
});
