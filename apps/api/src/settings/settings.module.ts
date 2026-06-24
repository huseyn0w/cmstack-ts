import { type PrismaClient, PrismaSettingRepository, SETTING_REPOSITORY } from '@cmstack-ts/db';
import { Module } from '@nestjs/common';
import { AccountsModule } from '../auth/accounts.module';
import { PRISMA } from '../prisma/prisma.module';
import { PublicSettingsController } from './public-settings.controller';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  // AccountsModule provides the JwtAuthGuard/PoliciesGuard used to gate the admin
  // settings controller.
  imports: [AccountsModule],
  controllers: [SettingsController, PublicSettingsController],
  providers: [
    SettingsService,
    {
      // Bind the repository token to its Prisma implementation, injecting the
      // shared PrismaClient singleton (explicit constructor wiring).
      provide: SETTING_REPOSITORY,
      useFactory: (prisma: PrismaClient) => new PrismaSettingRepository(prisma),
      inject: [PRISMA],
    },
  ],
})
export class SettingsModule {}
