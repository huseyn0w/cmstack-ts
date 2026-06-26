import { type PluginInfo, type UpdatePluginInput, updatePluginSchema } from '@cmstack-ts/config';
import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckPolicies } from '../authz/check-policies.decorator';
import { PoliciesGuard } from '../authz/policies.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PluginService } from './plugin.service';

/**
 * Admin plugin management. Enabling/disabling a plugin is an appearance/extension
 * concern gated by the `Plugin` subject — only Administrators (manage all) hold it.
 */
@Controller('plugins')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class PluginsController {
  constructor(private readonly plugins: PluginService) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'Plugin'))
  list(): Promise<PluginInfo[]> {
    return this.plugins.list();
  }

  @Put(':id')
  @CheckPolicies((ability) => ability.can('manage', 'Plugin'))
  setEnabled(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updatePluginSchema)) body: UpdatePluginInput,
  ): Promise<PluginInfo[]> {
    return this.plugins.setEnabled(id, body.enabled);
  }
}
