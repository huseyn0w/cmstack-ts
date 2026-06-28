import type { MailMessage } from './mail-transport';

/** Escape the five HTML-significant characters so user input can't break out of markup. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Build the new-comment moderation notification email. Pure (no I/O) so copy +
 * escaping are unit-tested. The author name and content come from an untrusted
 * public submission, so the HTML body escapes every value. `adminUrl`, when
 * supplied, links straight to the moderation queue.
 */
export function commentNotificationEmail(input: {
  postTitle: string;
  authorName: string;
  content: string;
  adminUrl?: string;
}): Omit<MailMessage, 'to'> {
  const subject = `New comment on "${input.postTitle}"`;

  const text = [
    `A new comment is awaiting moderation on "${input.postTitle}".`,
    '',
    `Author: ${input.authorName}`,
    '',
    input.content,
    ...(input.adminUrl ? ['', `Moderate it: ${input.adminUrl}`] : []),
  ].join('\n');

  const html = [
    `<p>A new comment is awaiting moderation on <strong>${escapeHtml(input.postTitle)}</strong>.</p>`,
    `<p><strong>Author:</strong> ${escapeHtml(input.authorName)}</p>`,
    `<p>${escapeHtml(input.content).replace(/\n/g, '<br>')}</p>`,
    ...(input.adminUrl ? [`<p><a href="${escapeHtml(input.adminUrl)}">Moderate it</a></p>`] : []),
  ].join('\n');

  return { subject, text, html };
}
