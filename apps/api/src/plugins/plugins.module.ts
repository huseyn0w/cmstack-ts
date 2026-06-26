import { PrismaSettingRepository, SETTING_REPOSITORY } from '@cmstack-ts/db';
import { Logger, Module, type OnModuleInit } from '@nestjs/common';
import { AccountsModule } from '../auth/accounts.module';
import { HtmlSanitizerService } from '../content/html-sanitizer.service';
import { provideRepository } from '../persistence/repository.providers';
import { availablePlugins } from './available-plugins';
import { HookRegistry } from './hook-registry';
import { PluginService } from './plugin.service';
import { PluginsController } from './plugins.controller';
import { PublicPluginsController } from './public-plugins.controller';
import { scopedPluginApi } from './scoped-plugin-api';

/**
 * Owns the hook registry, registers every available plugin once at bootstrap
 * (handlers tagged with the plugin id), then loads the persisted enabled set so
 * disabled plugins' handlers are gated out. Exports `HookRegistry` so feature
 * modules can drive extension points (`applyFilters` / `emit` / `renderRegion`).
 */
@Module({
  imports: [AccountsModule],
  controllers: [PluginsController, PublicPluginsController],
  providers: [
    HookRegistry,
    PluginService,
    HtmlSanitizerService,
    provideRepository(SETTING_REPOSITORY, PrismaSettingRepository),
  ],
  exports: [HookRegistry],
})
export class PluginsModule implements OnModuleInit {
  private readonly logger = new Logger('PluginsModule');

  constructor(
    private readonly registry: HookRegistry,
    private readonly plugins: PluginService,
  ) {}

  async onModuleInit(): Promise<void> {
    for (const plugin of availablePlugins) {
      plugin.register(scopedPluginApi(this.registry, plugin.id));
      this.logger.log(`Registered plugin: ${plugin.name} (${plugin.id})`);
    }
    await this.plugins.loadEnabled();
  }
}
