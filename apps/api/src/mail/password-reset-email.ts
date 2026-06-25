import type { MailMessage } from './mail-transport';

/** Escape the five HTML-significant characters so a URL can't break out of markup. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Build the password-reset email. Pure (no I/O) so the copy and the escaping are
 * unit-tested in isolation. The reset URL is escaped before being placed in the
 * HTML body and `href`.
 */
export function passwordResetEmail(resetUrl: string, ttlMinutes: number): Omit<MailMessage, 'to'> {
  const safeUrl = escapeHtml(resetUrl);
  const text = [
    'You requested a password reset for your Cmstack-TS account.',
    '',
    `Open this link to choose a new password (valid for ${ttlMinutes} minutes):`,
    resetUrl,
    '',
    "If you didn't request this, you can safely ignore this email — your password",
    'will not change.',
  ].join('\n');

  const html = [
    '<p>You requested a password reset for your Cmstack-TS account.</p>',
    `<p>Open this link to choose a new password (valid for ${ttlMinutes} minutes):</p>`,
    `<p><a href="${safeUrl}">${safeUrl}</a></p>`,
    "<p>If you didn't request this, you can safely ignore this email — your password will not change.</p>",
  ].join('\n');

  return { subject: 'Reset your Cmstack-TS password', text, html };
}
