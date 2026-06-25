import { Inject, Injectable } from '@nestjs/common';
import { MAIL_TRANSPORT, type MailMessage, type MailTransport } from './mail-transport';

/**
 * Sends transactional email through the configured {@link MailTransport}. The
 * From address comes from `MAIL_FROM`; delivery (or the no-op log fallback) is
 * owned by the injected transport, keeping this service trivially testable.
 */
@Injectable()
export class MailService {
  private readonly from = process.env.MAIL_FROM?.trim() || 'Cmstack-TS <noreply@localhost>';

  constructor(@Inject(MAIL_TRANSPORT) private readonly transport: MailTransport) {}

  send(message: MailMessage): Promise<void> {
    return this.transport.send(this.from, message);
  }
}
