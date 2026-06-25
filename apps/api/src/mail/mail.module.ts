import { Module } from '@nestjs/common';
import { MAIL_TRANSPORT, createMailTransport } from './mail-transport';
import { MailService } from './mail.service';

/**
 * Provides the {@link MailService} and its environment-resolved transport (real
 * SMTP when configured, a logging no-op otherwise). Exported so feature modules
 * (e.g. password reset) can send mail.
 */
@Module({
  providers: [MailService, { provide: MAIL_TRANSPORT, useFactory: () => createMailTransport() }],
  exports: [MailService],
})
export class MailModule {}
