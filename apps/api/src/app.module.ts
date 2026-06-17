import { Module } from '@nestjs/common';
import { AccountsModule } from './auth/accounts.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, HealthModule, AccountsModule],
})
export class AppModule {}
