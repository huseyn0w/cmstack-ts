import { Inject, Injectable } from '@nestjs/common';
import { ACTIVE_THEME_KEY, type ThemeSetting, type UpdateThemeSettingInput } from '@typress/config';
import type { PrismaClient } from '@typress/db';
import { PRISMA } from '../prisma/prisma.module';

/**
 * Fallback theme when no `activeTheme` setting exists yet (e.g. a fresh DB before
 * seeding). Must match a theme id in the web theme catalogue; the web resolver
 * also falls back to its own default for any unknown value.
 */
export const DEFAULT_ACTIVE_THEME = 'editorial';

@Injectable()
export class SettingsService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async getActiveTheme(): Promise<ThemeSetting> {
    const row = await this.prisma.setting.findUnique({ where: { key: ACTIVE_THEME_KEY } });
    return { activeTheme: row?.value ?? DEFAULT_ACTIVE_THEME };
  }

  async setActiveTheme(input: UpdateThemeSettingInput): Promise<ThemeSetting> {
    const row = await this.prisma.setting.upsert({
      where: { key: ACTIVE_THEME_KEY },
      create: { key: ACTIVE_THEME_KEY, value: input.activeTheme },
      update: { value: input.activeTheme },
    });
    return { activeTheme: row.value };
  }
}
