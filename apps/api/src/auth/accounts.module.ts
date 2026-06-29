import { parseEnv } from '@cmstack-ts/config';
import {
  ACCOUNT_REPOSITORY,
  EMAIL_VERIFICATION_TOKEN_REPOSITORY,
  PASSWORD_RESET_TOKEN_REPOSITORY,
  PrismaAccountRepository,
  PrismaEmailVerificationTokenRepository,
  PrismaPasswordResetTokenRepository,
  PrismaRoleRepository,
  PrismaUserRepository,
  ROLE_REPOSITORY,
  USER_REPOSITORY,
} from '@cmstack-ts/db';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminController } from '../admin/admin.controller';
import { AdminService } from '../admin/admin.service';
import { PoliciesGuard } from '../authz/policies.guard';
import { MailModule } from '../mail/mail.module';
import { provideRepository } from '../persistence/repository.providers';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { EmailVerificationController } from './email-verification.controller';
import { EmailVerificationService } from './email-verification.service';
import { InternalSecretGuard } from './internal-secret.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';
import { PasswordResetController } from './password-reset.controller';
import { PasswordResetService } from './password-reset.service';
import { PasswordService } from './password.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => {
        const env = parseEnv();
        return {
          secret: env.AUTH_SECRET,
          signOptions: { expiresIn: env.AUTH_TOKEN_TTL },
        };
      },
    }),
    MailModule,
  ],
  controllers: [
    AccountsController,
    AdminController,
    UsersController,
    PasswordResetController,
    EmailVerificationController,
  ],
  providers: [
    AccountsService,
    UsersService,
    AdminService,
    PasswordService,
    PasswordResetService,
    EmailVerificationService,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    PoliciesGuard,
    InternalSecretGuard,
    provideRepository(USER_REPOSITORY, PrismaUserRepository),
    provideRepository(ACCOUNT_REPOSITORY, PrismaAccountRepository),
    provideRepository(ROLE_REPOSITORY, PrismaRoleRepository),
    provideRepository(PASSWORD_RESET_TOKEN_REPOSITORY, PrismaPasswordResetTokenRepository),
    provideRepository(EMAIL_VERIFICATION_TOKEN_REPOSITORY, PrismaEmailVerificationTokenRepository),
  ],
  // Exported so other feature modules can reuse the auth guards (which depend on
  // JwtService + AccountsService) to protect their own routes.
  exports: [JwtModule, AccountsService, JwtAuthGuard, OptionalJwtAuthGuard, PoliciesGuard],
})
export class AccountsModule {}
