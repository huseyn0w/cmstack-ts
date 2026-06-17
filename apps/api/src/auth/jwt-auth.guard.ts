import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AccountsService } from './accounts.service';
import type { AuthenticatedUser } from './authenticated-user';

/**
 * Authenticates a request from its `Authorization: Bearer <jwt>` header. On
 * success it attaches the fresh user (loaded from the database, so role and
 * permission changes take effect immediately) to `request.user`.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly accounts: AccountsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
    if (!token) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    let subject: string;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
      subject = payload.sub;
    } catch {
      throw new UnauthorizedException('Invalid or expired token.');
    }

    const user = await this.accounts.getAuthenticatedUserById(subject);
    if (!user) {
      throw new UnauthorizedException('User no longer exists.');
    }

    request.user = user;
    return true;
  }
}
