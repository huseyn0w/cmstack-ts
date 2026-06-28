import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AccountsModule } from './auth/accounts.module';
import { CommentsModule } from './comments/comments.module';
import { ContactModule } from './contact/contact.module';
import { ContentModule } from './content/content.module';
import { HealthModule } from './health/health.module';
import { MediaModule } from './media/media.module';
import { MenusModule } from './menus/menus.module';
import { PluginsModule } from './plugins/plugins.module';
import { PrismaModule } from './prisma/prisma.module';
import { SeoModule } from './seo/seo.module';
import { SettingsModule } from './settings/settings.module';
import { SpamModule } from './spam/spam.module';

@Module({
  imports: [
    // Rate-limiting config; ThrottlerGuard is applied per-route on the
    // spam-sensitive endpoints (auth + comment submission).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    // Enables @Interval/@Cron workers (e.g. the scheduled-publishing scheduler).
    ScheduleModule.forRoot(),
    PrismaModule,
    HealthModule,
    AccountsModule,
    ContentModule,
    MediaModule,
    SettingsModule,
    PluginsModule,
    SeoModule,
    SpamModule,
    CommentsModule,
    MenusModule,
    ContactModule,
  ],
})
export class AppModule {}
