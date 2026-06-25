import { describe, expect, it } from 'vitest';
import { buildVerificationMeta } from './verification';

const empty = {
  googleSiteVerification: '',
  bingSiteVerification: '',
  yandexVerification: '',
  facebookDomainVerification: '',
  pinterestVerification: '',
  customVerificationTags: [],
};

describe('buildVerificationMeta', () => {
  it('returns no google/yandex and an empty other map when nothing is set', () => {
    const m = buildVerificationMeta(empty);
    expect(m.google).toBeUndefined();
    expect(m.yandex).toBeUndefined();
    expect(m.other).toEqual({});
  });

  it('maps named tokens to google/yandex and the canonical other names', () => {
    const m = buildVerificationMeta({
      ...empty,
      googleSiteVerification: 'g-tok',
      yandexVerification: 'y-tok',
      bingSiteVerification: 'b-tok',
      facebookDomainVerification: 'fb-tok',
      pinterestVerification: 'pin-tok',
    });
    expect(m.google).toBe('g-tok');
    expect(m.yandex).toBe('y-tok');
    expect(m.other['msvalidate.01']).toBe('b-tok');
    expect(m.other['facebook-domain-verification']).toBe('fb-tok');
    expect(m.other['p:domain_verify']).toBe('pin-tok');
  });

  it('includes custom pairs and drops blank/duplicate names', () => {
    const m = buildVerificationMeta({
      ...empty,
      bingSiteVerification: 'b-tok',
      customVerificationTags: [
        { name: 'custom-one', content: 'c1' },
        { name: 'custom-one', content: 'c2' }, // duplicate name → first wins
        { name: 'msvalidate.01', content: 'override-ignored' }, // named field wins
      ],
    });
    expect(m.other['custom-one']).toBe('c1');
    expect(m.other['msvalidate.01']).toBe('b-tok');
  });
});
