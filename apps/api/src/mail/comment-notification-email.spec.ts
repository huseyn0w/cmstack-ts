import { describe, expect, it } from 'vitest';
import { commentNotificationEmail } from './comment-notification-email';

describe('commentNotificationEmail', () => {
  const base = {
    postTitle: 'Hello World',
    authorName: 'Ada',
    content: 'Great post!',
  };

  it('puts the post title in the subject', () => {
    const mail = commentNotificationEmail(base);
    expect(mail.subject).toBe('New comment on "Hello World"');
  });

  it('includes the author and content in both text and html', () => {
    const mail = commentNotificationEmail(base);
    expect(mail.text).toContain('Ada');
    expect(mail.text).toContain('Great post!');
    expect(mail.html).toContain('Ada');
    expect(mail.html).toContain('Great post!');
  });

  it('HTML-escapes every untrusted field', () => {
    const mail = commentNotificationEmail({
      postTitle: 'A & B',
      authorName: '<script>x</script>',
      content: 'a < b & "c"',
    });
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
    expect(mail.html).toContain('A &amp; B');
    // The subject is plain text (not HTML), so it carries the raw title.
    expect(mail.subject).toBe('New comment on "A & B"');
  });

  it('adds a moderation link only when an admin URL is supplied', () => {
    const without = commentNotificationEmail(base);
    expect(without.text).not.toContain('http');
    const withUrl = commentNotificationEmail({
      ...base,
      adminUrl: 'https://site.test/admin/comments',
    });
    expect(withUrl.text).toContain('https://site.test/admin/comments');
    expect(withUrl.html).toContain('href="https://site.test/admin/comments"');
  });
});
