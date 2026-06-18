import { Module } from '@nestjs/common';
import { AccountsModule } from './auth/accounts.module';
import { ContentModule } from './content/content.module';
import { HealthModule } from './health/health.module';
import { MediaModule } from './media/media.module';
import { PrismaModule } from './prisma/prisma.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [PrismaModule, HealthModule, AccountsModule, ContentModule, MediaModule, SettingsModule],
})
export class AppModule {}
