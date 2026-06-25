import { Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';

/** A transactional email message (plain text required, HTML optional). */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** The seam the {@link MailService} sends through — swappable per environment. */
export interface MailTransport {
  send(from: string, message: MailMessage): Promise<void>;
}

export const MAIL_TRANSPORT = Symbol('MAIL_TRANSPORT');

/**
 * Fallback transport used when SMTP is not configured: logs the message instead
 * of sending it, so the local/demo stack runs without a real SMTP server (the
 * reset link is printed to the API logs).
 */
export class LoggerMailTransport implements MailTransport {
  private readonly logger = new Logger('MailService');

  async send(from: string, message: MailMessage): Promise<void> {
    this.logger.log(
      `[mail:noop] SMTP not configured — not sending.\n  From: ${from}\n  To: ${message.to}\n  Subject: ${message.subject}\n  ${message.text.replace(/\n/g, '\n  ')}`,
    );
  }
}

/** Real SMTP delivery via nodemailer. A thin adapter over the transporter. */
export class SmtpMailTransport implements MailTransport {
  constructor(private readonly transporter: Transporter) {}

  async send(from: string, message: MailMessage): Promise<void> {
    await this.transporter.sendMail({
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}

/**
 * Build the transport from the environment: real SMTP when `SMTP_HOST` is set,
 * otherwise the logger fallback. Mirrors the optional-by-design pattern used by
 * the reCAPTCHA service.
 */
export function createMailTransport(env: NodeJS.ProcessEnv = process.env): MailTransport {
  const host = env.SMTP_HOST?.trim();
  if (!host) return new LoggerMailTransport();

  const user = env.SMTP_USER?.trim();
  const pass = env.SMTP_PASSWORD;
  const transporter = nodemailer.createTransport({
    host,
    port: Number(env.SMTP_PORT ?? 587),
    secure: String(env.SMTP_SECURE) === 'true',
    auth: user ? { user, pass } : undefined,
  });
  return new SmtpMailTransport(transporter);
}
