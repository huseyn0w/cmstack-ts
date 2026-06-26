import {
  CATEGORY_REPOSITORY,
  MENU_REPOSITORY,
  PAGE_REPOSITORY,
  POST_REPOSITORY,
  PrismaCategoryRepository,
  PrismaMenuRepository,
  PrismaPageRepository,
  PrismaPostRepository,
} from '@cmstack-ts/db';
import { Module } from '@nestjs/common';
import { AccountsModule } from '../auth/accounts.module';
import { CacheModule } from '../cache/cache.module';
import { provideRepository } from '../persistence/repository.providers';
import { PluginsModule } from '../plugins/plugins.module';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';
import { PublicMenuController } from './public-menu.controller';

@Module({
  // AccountsModule provides the JwtAuthGuard/PoliciesGuard used to gate the admin
  // menu controller. The Post/Page/Category repositories are bound here (own
  // bindings per module) only for slug resolution of reference menu items.
  // CacheModule caches the public menu read; PluginsModule provides the
  // HookRegistry the service emits the invalidation event through.
  imports: [AccountsModule, CacheModule, PluginsModule],
  controllers: [MenuController, PublicMenuController],
  providers: [
    MenuService,
    provideRepository(MENU_REPOSITORY, PrismaMenuRepository),
    provideRepository(POST_REPOSITORY, PrismaPostRepository),
    provideRepository(PAGE_REPOSITORY, PrismaPageRepository),
    provideRepository(CATEGORY_REPOSITORY, PrismaCategoryRepository),
  ],
})
export class MenusModule {}
