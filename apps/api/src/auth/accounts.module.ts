import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { parseEnv } from '@typress/config';
import { AdminController } from '../admin/admin.controller';
import { PoliciesGuard } from '../authz/policies.guard';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { InternalSecretGuard } from './internal-secret.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PasswordService } from './password.service';

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
  ],
  controllers: [AccountsController, AdminController],
  providers: [AccountsService, PasswordService, JwtAuthGuard, PoliciesGuard, InternalSecretGuard],
})
export class AccountsModule {}
