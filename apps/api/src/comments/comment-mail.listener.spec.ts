import type { SiteProfileRepository } from '@cmstack-ts/db';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommentMailListener } from './comment-mail.listener';

let profiles: { get: Mock };
let mail: { send: Mock };
let listener: CommentMailListener;

const payload = {
  id: 'c1',
  postSlug: 'hello',
  postTitle: 'Hello',
  authorName: 'Ada',
  content: 'Nice',
};

beforeEach(() => {
  profiles = { get: vi.fn() };
  mail = { send: vi.fn().mockResolvedValue(undefined) };
  listener = new CommentMailListener(profiles as unknown as SiteProfileRepository, mail as never);
});

describe('CommentMailListener', () => {
  it('sends to the profile contactEmail when set, with the post title in the subject', async () => {
    profiles.get.mockResolvedValue({ contactEmail: 'owner@x.test' });
    await listener.handle(payload);
    expect(mail.send).toHaveBeenCalledTimes(1);
    const sent = mail.send.mock.calls[0]?.[0];
    expect(sent.to).toBe('owner@x.test');
    expect(sent.subject).toContain('Hello');
  });

  it('falls back to MAIL_FROM when no profile email and no env', async () => {
    const prev = process.env.COMMENT_NOTIFICATION_EMAIL;
    const prevContact = process.env.CONTACT_RECIPIENT_EMAIL;
    process.env.COMMENT_NOTIFICATION_EMAIL = '';
    process.env.CONTACT_RECIPIENT_EMAIL = '';
    profiles.get.mockResolvedValue({ contactEmail: '' });
    await listener.handle(payload);
    expect(mail.send.mock.calls[0]?.[0].to).toBeTruthy();
    process.env.COMMENT_NOTIFICATION_EMAIL = prev;
    process.env.CONTACT_RECIPIENT_EMAIL = prevContact;
  });

  it('does not throw when the profile lookup returns null', async () => {
    profiles.get.mockResolvedValue(null);
    await expect(listener.handle(payload)).resolves.toBeUndefined();
    expect(mail.send).toHaveBeenCalled();
  });

  it('includes a moderation link when WEB_ORIGIN is set', async () => {
    const prev = process.env.WEB_ORIGIN;
    process.env.WEB_ORIGIN = 'https://site.test';
    profiles.get.mockResolvedValue({ contactEmail: 'owner@x.test' });
    await listener.handle(payload);
    expect(mail.send.mock.calls[0]?.[0].text).toContain('https://site.test/admin/comments');
    process.env.WEB_ORIGIN = prev;
  });
});
