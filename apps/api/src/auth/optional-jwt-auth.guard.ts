import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AccountsService } from './accounts.service';
import type { AuthenticatedUser } from './authenticated-user';

/**
 * Like {@link JwtAuthGuard} but never rejects: if a valid `Bearer` token is
 * present it attaches the fresh user to `request.user`, otherwise the request
 * proceeds anonymously (`request.user` stays undefined). Used on endpoints that
 * serve both guests and signed-in users (public comment submit + read).
 */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly accounts: AccountsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
    if (!token) return true;

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
      const user = await this.accounts.getAuthenticatedUserById(payload.sub);
      if (user) request.user = user;
    } catch {
      // Invalid/expired token → treat as anonymous (never reject).
    }
    return true;
  }
}
