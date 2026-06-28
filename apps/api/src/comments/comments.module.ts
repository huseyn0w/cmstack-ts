import {
  COMMENT_REPOSITORY,
  POST_REPOSITORY,
  PrismaCommentRepository,
  PrismaPostRepository,
  PrismaSiteProfileRepository,
  SITE_PROFILE_REPOSITORY,
} from '@cmstack-ts/db';
import { Module, type OnModuleInit } from '@nestjs/common';
import { AccountsModule } from '../auth/accounts.module';
import { MailModule } from '../mail/mail.module';
import { provideRepository } from '../persistence/repository.providers';
import { HookRegistry } from '../plugins/hook-registry';
import { PluginsModule } from '../plugins/plugins.module';
import { SpamModule } from '../spam/spam.module';
import { CommentMailListener } from './comment-mail.listener';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { PublicCommentsController } from './public-comments.controller';

@Module({
  // AccountsModule provides the guards for the admin controller; SpamModule
  // provides reCAPTCHA verification for public submissions; MailModule delivers
  // the moderator notification; PluginsModule provides the HookRegistry observer.
  imports: [AccountsModule, SpamModule, MailModule, PluginsModule],
  controllers: [CommentsController, PublicCommentsController],
  providers: [
    CommentsService,
    CommentMailListener,
    provideRepository(COMMENT_REPOSITORY, PrismaCommentRepository),
    provideRepository(POST_REPOSITORY, PrismaPostRepository),
    provideRepository(SITE_PROFILE_REPOSITORY, PrismaSiteProfileRepository),
  ],
})
export class CommentsModule implements OnModuleInit {
  constructor(
    private readonly hooks: HookRegistry,
    private readonly listener: CommentMailListener,
  ) {}

  onModuleInit(): void {
    this.hooks.addAction('comment.submitted', (payload) => this.listener.handle(payload));
  }
}
