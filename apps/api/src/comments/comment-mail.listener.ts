import { resolveContactRecipient } from '@cmstack-ts/config';
import { SITE_PROFILE_REPOSITORY, type SiteProfileRepository } from '@cmstack-ts/db';
import { Inject, Injectable } from '@nestjs/common';
import { commentNotificationEmail } from '../mail/comment-notification-email';
import { MailService } from '../mail/mail.service';
import type { ActionMap } from '../plugins/hooks';

/**
 * Notifies the moderator when a new (PENDING) comment is stored. Wired to the
 * `comment.submitted` action in the module's onModuleInit. emit() is
 * fault-isolated, so a failure here is logged and swallowed — it never fails the
 * public comment submit.
 */
@Injectable()
export class CommentMailListener {
  constructor(
    @Inject(SITE_PROFILE_REPOSITORY) private readonly profiles: SiteProfileRepository,
    private readonly mail: MailService,
  ) {}

  async handle(payload: ActionMap['comment.submitted']): Promise<void> {
    const profile = await this.profiles.get();
    // Recipient: the site's contact email, else a comment-specific env, else the
    // shared contact-recipient env, else MAIL_FROM (reuses the contact resolver).
    const envEmail =
      process.env.COMMENT_NOTIFICATION_EMAIL?.trim() || process.env.CONTACT_RECIPIENT_EMAIL;
    const recipient = resolveContactRecipient(
      profile?.contactEmail ?? '',
      envEmail,
      process.env.MAIL_FROM?.trim() || 'Cmstack-TS <noreply@localhost>',
    );

    const origin = process.env.WEB_ORIGIN?.trim();
    const message = commentNotificationEmail({
      postTitle: payload.postTitle,
      authorName: payload.authorName,
      content: payload.content,
      adminUrl: origin ? `${origin.replace(/\/+$/, '')}/admin/comments` : undefined,
    });
    await this.mail.send({ to: recipient, ...message });
  }
}
