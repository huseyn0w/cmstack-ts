import {
  ACTIVE_THEME_KEY,
  type ThemeSetting,
  type UpdateThemeSettingInput,
} from '@cmstack-ts/config';
import { SETTING_REPOSITORY, type SettingRepository } from '@cmstack-ts/db';
import { Inject, Injectable } from '@nestjs/common';

/**
 * Fallback theme when no `activeTheme` setting exists yet (e.g. a fresh DB before
 * seeding). Must match a theme id in the web theme catalogue; the web resolver
 * also falls back to its own default for any unknown value.
 */
export const DEFAULT_ACTIVE_THEME = 'editorial';

@Injectable()
export class SettingsService {
  constructor(@Inject(SETTING_REPOSITORY) private readonly settings: SettingRepository) {}

  async getActiveTheme(): Promise<ThemeSetting> {
    const row = await this.settings.get(ACTIVE_THEME_KEY);
    return { activeTheme: row?.value ?? DEFAULT_ACTIVE_THEME };
  }

  async setActiveTheme(input: UpdateThemeSettingInput): Promise<ThemeSetting> {
    const row = await this.settings.upsert(ACTIVE_THEME_KEY, input.activeTheme);
    return { activeTheme: row.value };
  }
}
