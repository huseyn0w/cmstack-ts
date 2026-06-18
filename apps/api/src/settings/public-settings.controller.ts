import { Controller, Get } from '@nestjs/common';
import type { ThemeSetting } from '@typress/config';
import { SettingsService } from './settings.service';

/**
 * Public, unauthenticated read of the active theme. The server-rendered site
 * needs this before any session exists, so it must be readable without auth.
 */
@Controller('public/settings')
export class PublicSettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('theme')
  getTheme(): Promise<ThemeSetting> {
    return this.settings.getActiveTheme();
  }
}
