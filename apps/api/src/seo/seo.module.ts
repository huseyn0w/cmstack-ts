import {
  FAQ_REPOSITORY,
  PrismaFaqRepository,
  PrismaServiceRepository,
  PrismaSiteProfileRepository,
  SERVICE_REPOSITORY,
  SITE_PROFILE_REPOSITORY,
} from '@cmstack-ts/db';
import { Module } from '@nestjs/common';
import { AccountsModule } from '../auth/accounts.module';
import { CacheModule } from '../cache/cache.module';
import { provideRepository } from '../persistence/repository.providers';
import { PluginsModule } from '../plugins/plugins.module';
import { PublicSeoController } from './public-seo.controller';
import { SeoController } from './seo.controller';
import { SeoService } from './seo.service';

@Module({
  // AccountsModule provides the JwtAuthGuard/PoliciesGuard used to gate the admin
  // SEO controller. CacheModule caches the public SEO read; PluginsModule provides
  // the HookRegistry the service emits the invalidation event through.
  imports: [AccountsModule, CacheModule, PluginsModule],
  controllers: [SeoController, PublicSeoController],
  providers: [
    SeoService,
    provideRepository(SITE_PROFILE_REPOSITORY, PrismaSiteProfileRepository),
    provideRepository(SERVICE_REPOSITORY, PrismaServiceRepository),
    provideRepository(FAQ_REPOSITORY, PrismaFaqRepository),
  ],
})
export class SeoModule {}
