import { Injectable, Logger } from '@nestjs/common';
import type { ActionMap, ActionName, FilterMap, FilterName, RegionName } from './hooks';
import type { ActionHandler, FilterHandler, PluginApi, RegionRenderer } from './plugin.types';

interface Entry {
  handler: (value: unknown) => unknown;
  priority: number;
  owner?: string;
}

interface RegionEntry {
  render: RegionRenderer;
  priority: number;
  owner?: string;
}

/**
 * The typed hook/event registry. Plugins register filter, action and region
 * handlers through the `PluginApi` surface; the rest of the app drives extension
 * points via `applyFilters` (transform a value), `emit` (fire an event) and
 * `renderRegion` (collect HTML). Handlers run in ascending priority order; equal
 * priorities keep registration order.
 *
 * Each handler carries an optional `owner` (the registering plugin's id). A
 * runtime enabled-set (see {@link setEnabledPlugins}) gates owned handlers so a
 * plugin can be disabled without a restart; **un-owned (core) handlers always
 * run** — they are wired by the app itself, not by a toggleable plugin.
 */
@Injectable()
export class HookRegistry implements PluginApi {
  private readonly logger = new Logger('HookRegistry');
  private readonly filters = new Map<string, Entry[]>();
  private readonly actions = new Map<string, Entry[]>();
  private readonly regions = new Map<string, RegionEntry[]>();
  // null = no gate configured yet (everything runs); a Set = only these owners are enabled.
  private enabled: Set<string> | null = null;

  addFilter<K extends FilterName>(
    name: K,
    handler: FilterHandler<K>,
    priority = 10,
    owner?: string,
  ): void {
    this.insert(this.filters, name, { handler: handler as Entry['handler'], priority, owner });
  }

  addAction<K extends ActionName>(
    name: K,
    handler: ActionHandler<K>,
    priority = 10,
    owner?: string,
  ): void {
    this.insert(this.actions, name, { handler: handler as Entry['handler'], priority, owner });
  }

  addRegion(name: RegionName, render: RegionRenderer, priority = 10, owner?: string): void {
    const entries = this.regions.get(name) ?? [];
    entries.push({ render, priority, owner });
    entries.sort((a, b) => a.priority - b.priority);
    this.regions.set(name, entries);
  }

  /** Replace the enabled-plugin gate. Un-owned (core) handlers are always active. */
  setEnabledPlugins(ids: string[]): void {
    this.enabled = new Set(ids);
  }

  private isActive(owner?: string): boolean {
    if (!owner) return true; // core handler
    if (this.enabled === null) return true; // no gate configured yet
    return this.enabled.has(owner);
  }

  /** Thread `value` through every active filter for `name`, in order. */
  async applyFilters<K extends FilterName>(name: K, value: FilterMap[K]): Promise<FilterMap[K]> {
    const entries = this.filters.get(name);
    if (!entries) return value;
    let acc: FilterMap[K] = value;
    for (const entry of entries) {
      if (!this.isActive(entry.owner)) continue;
      acc = (await entry.handler(acc)) as FilterMap[K];
    }
    return acc;
  }

  /**
   * Invoke every active action listener for `name`, in order. Actions are
   * fire-and-forget: a throwing listener is logged and isolated so it can neither
   * break the caller nor stop the other listeners.
   */
  async emit<K extends ActionName>(name: K, payload: ActionMap[K]): Promise<void> {
    const entries = this.actions.get(name);
    if (!entries) return;
    for (const entry of entries) {
      if (!this.isActive(entry.owner)) continue;
      try {
        await entry.handler(payload);
      } catch (error) {
        this.logger.error(`Action listener for "${name}" threw`, error as Error);
      }
    }
  }

  /**
   * Concatenate the HTML contributed by every active plugin for a region, in
   * priority order. Each renderer is fault-isolated (a throw is logged + skipped)
   * so one bad contributor can't blank the whole region.
   */
  async renderRegion(name: RegionName): Promise<string> {
    const entries = this.regions.get(name);
    if (!entries) return '';
    let html = '';
    for (const entry of entries) {
      if (!this.isActive(entry.owner)) continue;
      try {
        html += await entry.render();
      } catch (error) {
        this.logger.error(`Region renderer for "${name}" threw`, error as Error);
      }
    }
    return html;
  }

  private insert(map: Map<string, Entry[]>, name: string, entry: Entry): void {
    const entries = map.get(name) ?? [];
    entries.push(entry);
    // Stable ascending sort: Array.prototype.sort is stable, so equal priorities
    // retain registration order.
    entries.sort((a, b) => a.priority - b.priority);
    map.set(name, entries);
  }
}
