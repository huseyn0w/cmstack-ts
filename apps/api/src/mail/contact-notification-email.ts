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
 * Build the contact-form notification email. Pure (no I/O) so copy + escaping are
 * unit-tested. All fields come from an untrusted public submission, so the HTML
 * body escapes every value.
 */
export function contactNotificationEmail(input: {
  name: string;
  email: string;
  subject: string | null;
  message: string;
}): Omit<MailMessage, 'to'> {
  const subject = input.subject?.trim()
    ? `Contact form: ${input.subject.trim()}`
    : 'New contact form message';

  const text = [
    'You received a new message through the contact form.',
    '',
    `Name: ${input.name}`,
    `Email: ${input.email}`,
    ...(input.subject ? [`Subject: ${input.subject}`] : []),
    '',
    input.message,
  ].join('\n');

  const html = [
    '<p>You received a new message through the contact form.</p>',
    `<p><strong>Name:</strong> ${escapeHtml(input.name)}</p>`,
    `<p><strong>Email:</strong> ${escapeHtml(input.email)}</p>`,
    ...(input.subject ? [`<p><strong>Subject:</strong> ${escapeHtml(input.subject)}</p>`] : []),
    `<p>${escapeHtml(input.message).replace(/\n/g, '<br>')}</p>`,
  ].join('\n');

  return { subject, text, html };
}
