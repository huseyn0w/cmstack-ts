import { z } from 'zod';

/** Setting key holding the JSON array of enabled plugin ids. */
export const PLUGINS_ENABLED_KEY = 'enabledPlugins';

export const updatePluginSchema = z.object({ enabled: z.boolean() });
export type UpdatePluginInput = z.infer<typeof updatePluginSchema>;

export const pluginInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  enabled: z.boolean(),
});
export type PluginInfo = z.infer<typeof pluginInfoSchema>;

export const pluginInfoListSchema = z.array(pluginInfoSchema);

/** Public render-region payload: region name -> sanitized HTML (only present regions). */
export const pluginRegionsSchema = z.object({ 'site.footer': z.string() }).partial();
export type PluginRegions = z.infer<typeof pluginRegionsSchema>;
