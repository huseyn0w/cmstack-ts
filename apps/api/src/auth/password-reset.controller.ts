import {
  type PasswordResetConfirmInput,
  type PasswordResetRequestInput,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
} from '@cmstack-ts/config';
import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PasswordResetService } from './password-reset.service';

/**
 * Public password-reset endpoints. Both are rate-limited; the request endpoint
 * always answers 200 so it cannot be used to probe which emails are registered.
 */
@Controller('auth')
export class PasswordResetController {
  constructor(private readonly reset: PasswordResetService) {}

  @Post('password-reset/request')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async request(
    @Body(new ZodValidationPipe(passwordResetRequestSchema)) body: PasswordResetRequestInput,
  ): Promise<{ ok: true }> {
    await this.reset.request(body);
    return { ok: true };
  }

  @Post('password-reset/confirm')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async confirm(
    @Body(new ZodValidationPipe(passwordResetConfirmSchema)) body: PasswordResetConfirmInput,
  ): Promise<{ ok: true }> {
    await this.reset.confirm(body);
    return { ok: true };
  }
}
