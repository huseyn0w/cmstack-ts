import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import {
  type AuthResult,
  type LoginInput,
  type OAuthInput,
  type PublicUser,
  type RegisterInput,
  loginSchema,
  oauthSchema,
  registerSchema,
} from '@typress/config';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AccountsService } from './accounts.service';
import type { AuthenticatedUser } from './authenticated-user';
import { CurrentUser } from './current-user.decorator';
import { InternalSecretGuard } from './internal-secret.guard';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Post('register')
  register(@Body(new ZodValidationPipe(registerSchema)) body: RegisterInput): Promise<AuthResult> {
    return this.accounts.register(body);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body(new ZodValidationPipe(loginSchema)) body: LoginInput): Promise<AuthResult> {
    return this.accounts.login(body);
  }

  // Server-to-server only: called by the web app after a provider sign-in.
  @Post('oauth')
  @HttpCode(200)
  @UseGuards(InternalSecretGuard)
  oauth(@Body(new ZodValidationPipe(oauthSchema)) body: OAuthInput): Promise<AuthResult> {
    return this.accounts.oauth(body);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser): PublicUser {
    return { id: user.id, email: user.email, name: user.name, image: user.image, role: user.role };
  }
}
