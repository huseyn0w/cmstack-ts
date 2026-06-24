import {
  COMMENT_REPOSITORY,
  POST_REPOSITORY,
  PrismaCommentRepository,
  PrismaPostRepository,
} from '@cmstack-ts/db';
import { Module } from '@nestjs/common';
import { AccountsModule } from '../auth/accounts.module';
import { provideRepository } from '../persistence/repository.providers';
import { SpamModule } from '../spam/spam.module';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { PublicCommentsController } from './public-comments.controller';

@Module({
  // AccountsModule provides the guards for the admin controller; SpamModule
  // provides reCAPTCHA verification for public submissions.
  imports: [AccountsModule, SpamModule],
  controllers: [CommentsController, PublicCommentsController],
  providers: [
    CommentsService,
    provideRepository(COMMENT_REPOSITORY, PrismaCommentRepository),
    provideRepository(POST_REPOSITORY, PrismaPostRepository),
  ],
})
export class CommentsModule {}
