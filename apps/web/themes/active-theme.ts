import 'server-only';

import { apiBaseUrl } from '@/app/lib/api';
import { themeSettingSchema } from '@typress/config';
import { DEFAULT_THEME_ID, resolveTheme } from './registry';
import type { Theme } from './types';

/**
 * Resolve the active public theme for a server-rendered request. Reads the
 * `activeTheme` setting from the API (the source of truth) and maps it to a
 * concrete theme. Any unreachable API, bad response, or unknown id degrades to
 * the default theme so the public site always renders.
 */
export async function getActiveTheme(): Promise<Theme> {
  try {
    const res = await fetch(`${apiBaseUrl}/public/settings/theme`, { cache: 'no-store' });
    if (!res.ok) return resolveTheme(DEFAULT_THEME_ID);
    const parsed = themeSettingSchema.safeParse(await res.json());
    return resolveTheme(parsed.success ? parsed.data.activeTheme : DEFAULT_THEME_ID);
  } catch {
    return resolveTheme(DEFAULT_THEME_ID);
  }
}
