import { describe, expect, it } from 'vitest';
import { passwordResetEmail } from './password-reset-email';

describe('passwordResetEmail', () => {
  it('embeds the reset URL and TTL in subject/text/html', () => {
    const msg = passwordResetEmail('https://site.test/reset-password?token=abc', 60);
    expect(msg.subject).toMatch(/reset/i);
    expect(msg.text).toContain('https://site.test/reset-password?token=abc');
    expect(msg.text).toContain('60');
    expect(msg.html).toContain('https://site.test/reset-password?token=abc');
  });

  it('escapes the URL in the HTML body (no raw-quote breakout)', () => {
    const msg = passwordResetEmail('https://x.test/r?token=a"b<c', 30);
    expect(msg.html).not.toContain('"b<c'); // dangerous chars are escaped
    expect(msg.html).toContain('&lt;');
  });
});
