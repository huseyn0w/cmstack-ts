import {
  type ThemeSetting,
  type UpdateThemeSettingInput,
  updateThemeSettingSchema,
} from '@cmstack-ts/config';
import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckPolicies } from '../authz/check-policies.decorator';
import { PoliciesGuard } from '../authz/policies.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SettingsService } from './settings.service';

/**
 * Admin settings API. Theme switching is an appearance concern gated by the
 * `Setting` subject — only Administrators (manage all) hold it; Editors don't.
 */
@Controller('settings')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('theme')
  @CheckPolicies((ability) => ability.can('read', 'Setting'))
  getTheme(): Promise<ThemeSetting> {
    return this.settings.getActiveTheme();
  }

  @Put('theme')
  @CheckPolicies((ability) => ability.can('manage', 'Setting'))
  setTheme(
    @Body(new ZodValidationPipe(updateThemeSettingSchema)) body: UpdateThemeSettingInput,
  ): Promise<ThemeSetting> {
    return this.settings.setActiveTheme(body);
  }
}
