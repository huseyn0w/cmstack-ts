import { Module } from '@nestjs/common';
import { AccountsModule } from './auth/accounts.module';
import { ContentModule } from './content/content.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, HealthModule, AccountsModule, ContentModule],
})
export class AppModule {}
