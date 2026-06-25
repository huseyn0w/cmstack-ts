import { describe, expect, it } from 'vitest';
import { contactSubmissionSchema, resolveContactRecipient } from './contact';

describe('contactSubmissionSchema', () => {
  it('accepts a valid submission', () => {
    const r = contactSubmissionSchema.safeParse({
      name: 'Ada',
      email: 'ada@x.test',
      message: 'Hello there',
      subject: 'Hi',
    });
    expect(r.success).toBe(true);
  });
  it('rejects a bad email', () => {
    expect(
      contactSubmissionSchema.safeParse({ name: 'A', email: 'nope', message: 'hi' }).success,
    ).toBe(false);
  });
  it('rejects an empty message', () => {
    expect(
      contactSubmissionSchema.safeParse({ name: 'A', email: 'a@x.test', message: '' }).success,
    ).toBe(false);
  });
  it('allows the optional honeypot field', () => {
    const r = contactSubmissionSchema.safeParse({
      name: 'A',
      email: 'a@x.test',
      message: 'hi',
      company: 'bot',
    });
    expect(r.success).toBe(true);
  });
});

describe('resolveContactRecipient', () => {
  it('prefers the profile email', () => {
    expect(resolveContactRecipient('p@x.test', 'e@x.test', 'f@x.test')).toBe('p@x.test');
  });
  it('falls back to env then from', () => {
    expect(resolveContactRecipient('', 'e@x.test', 'f@x.test')).toBe('e@x.test');
    expect(resolveContactRecipient('', '', 'f@x.test')).toBe('f@x.test');
  });
  it('ignores whitespace-only values', () => {
    expect(resolveContactRecipient('  ', '  ', 'f@x.test')).toBe('f@x.test');
  });
});
