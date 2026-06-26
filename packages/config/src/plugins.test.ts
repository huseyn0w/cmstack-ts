import { describe, expect, it } from 'vitest';
import { PLUGINS_ENABLED_KEY, pluginInfoSchema, updatePluginSchema } from './plugins';

describe('plugin schemas', () => {
  it('exposes the settings key', () => {
    expect(PLUGINS_ENABLED_KEY).toBe('enabledPlugins');
  });
  it('updatePluginSchema requires a boolean enabled', () => {
    expect(updatePluginSchema.parse({ enabled: true }).enabled).toBe(true);
    expect(() => updatePluginSchema.parse({ enabled: 'yes' })).toThrow();
  });
  it('pluginInfoSchema parses the admin shape', () => {
    const p = pluginInfoSchema.parse({ id: 'x', name: 'X', description: 'd', enabled: false });
    expect(p.id).toBe('x');
  });
});
