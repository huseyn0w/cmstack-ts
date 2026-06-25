import { describe, expect, it } from 'vitest';
import { contactNotificationEmail } from './contact-notification-email';

describe('contactNotificationEmail', () => {
  it('includes the sender name, email and message in the text body', () => {
    const msg = contactNotificationEmail({
      name: 'Ada',
      email: 'ada@x.test',
      subject: 'Hi',
      message: 'Hello',
    });
    expect(msg.text).toContain('Ada');
    expect(msg.text).toContain('ada@x.test');
    expect(msg.text).toContain('Hello');
    expect(msg.subject).toContain('Hi');
  });

  it('escapes HTML in the HTML body to prevent injection', () => {
    const msg = contactNotificationEmail({
      name: '<script>',
      email: 'a@x.test',
      subject: null,
      message: '<b>x</b>',
    });
    expect(msg.html).not.toContain('<script>');
    expect(msg.html).toContain('&lt;script&gt;');
    expect(msg.html).toContain('&lt;b&gt;x&lt;/b&gt;');
  });

  it('uses a default subject when none is given', () => {
    const msg = contactNotificationEmail({
      name: 'A',
      email: 'a@x.test',
      subject: null,
      message: 'm',
    });
    expect(msg.subject).toBe('New contact form message');
  });
});
