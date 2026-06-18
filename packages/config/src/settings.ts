import { z } from 'zod';
import { slugSchema } from './content';

/**
 * Shared settings contracts. Settings are simple key/value rows owned by the API
 * (the source of truth). Phase 5 introduces the `activeTheme` setting that selects
 * which public theme the web app renders through.
 *
 * The catalogue of valid theme ids lives in the web app (themes are React
 * component sets), so the API only validates the value is a safe, slug-shaped id;
 * the admin UI constrains the choice to known themes and the web resolver falls
 * back to the default for any unknown value.
 */

/** Setting key for the active public theme. */
export const ACTIVE_THEME_KEY = 'activeTheme';

/** Request body for changing the active theme. */
export const updateThemeSettingSchema = z.object({
  activeTheme: slugSchema,
});
export type UpdateThemeSettingInput = z.infer<typeof updateThemeSettingSchema>;

/** Response shape for the active-theme setting (public + admin reads). */
export const themeSettingSchema = z.object({
  activeTheme: z.string(),
});
export type ThemeSetting = z.infer<typeof themeSettingSchema>;
