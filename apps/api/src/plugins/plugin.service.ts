import { PLUGINS_ENABLED_KEY, type PluginInfo } from '@cmstack-ts/config';
import { SETTING_REPOSITORY, type SettingRepository } from '@cmstack-ts/db';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { HtmlSanitizerService } from '../content/html-sanitizer.service';
import { availablePlugins } from './available-plugins';
import { HookRegistry } from './hook-registry';
import type { RegionName } from './hooks';

const REGION_NAMES: RegionName[] = ['site.footer'];

/**
 * Owns the runtime enabled-plugin state. Reads/writes the persisted set (a
 * `Setting`), drives the {@link HookRegistry} gate, and renders the public
 * render-region payload (sanitized). Plugins themselves are registered by
 * `PluginsModule` at bootstrap; this service only flips which are active.
 */
@Injectable()
export class PluginService {
  private readonly logger = new Logger(PluginService.name);
  private enabled = new Set<string>();

  constructor(
    @Inject(SETTING_REPOSITORY) private readonly settings: SettingRepository,
    private readonly registry: HookRegistry,
    private readonly sanitizer: HtmlSanitizerService,
  ) {}

  /** Read the persisted enabled set (default: all available) and drive the registry. */
  async loadEnabled(): Promise<void> {
    const row = await this.settings.get(PLUGINS_ENABLED_KEY);
    const all = availablePlugins.map((p) => p.id);
    let ids = all;
    if (row) {
      try {
        const parsed: unknown = JSON.parse(row.value);
        if (Array.isArray(parsed)) ids = parsed.filter((x): x is string => typeof x === 'string');
      } catch {
        this.logger.warn('Malformed enabledPlugins setting; enabling all plugins.');
      }
    }
    this.enabled = new Set(ids.filter((id) => all.includes(id)));
    this.registry.setEnabledPlugins([...this.enabled]);
  }

  async list(): Promise<PluginInfo[]> {
    return availablePlugins.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      enabled: this.enabled.has(p.id),
    }));
  }

  async setEnabled(id: string, enabled: boolean): Promise<PluginInfo[]> {
    if (!availablePlugins.some((p) => p.id === id)) {
      throw new NotFoundException('Plugin not found.');
    }
    if (enabled) this.enabled.add(id);
    else this.enabled.delete(id);
    const ids = [...this.enabled];
    await this.settings.upsert(PLUGINS_ENABLED_KEY, JSON.stringify(ids));
    this.registry.setEnabledPlugins(ids);
    return this.list();
  }

  /** Sanitized render-region payload for the public site (only non-empty regions). */
  async renderRegions(): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    for (const name of REGION_NAMES) {
      const html = await this.registry.renderRegion(name);
      if (html) out[name] = this.sanitizer.sanitize(html);
    }
    return out;
  }
}
