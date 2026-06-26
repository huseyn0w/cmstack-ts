import type { HookRegistry } from './hook-registry';
import type { PluginApi } from './plugin.types';

/** Wrap the registry so a plugin's handlers are tagged with its id (owner). */
export function scopedPluginApi(registry: HookRegistry, ownerId: string): PluginApi {
  return {
    addFilter: (name, handler, priority) => registry.addFilter(name, handler, priority, ownerId),
    addAction: (name, handler, priority) => registry.addAction(name, handler, priority, ownerId),
    addRegion: (name, render, priority) => registry.addRegion(name, render, priority, ownerId),
  };
}
