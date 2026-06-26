import { Controller, Get } from '@nestjs/common';
import { PluginService } from './plugin.service';

/** Unauthenticated render-region payload for the server-rendered public site. */
@Controller('public/plugins')
export class PublicPluginsController {
  constructor(private readonly plugins: PluginService) {}

  @Get('regions')
  regions(): Promise<Record<string, string>> {
    return this.plugins.renderRegions();
  }
}
