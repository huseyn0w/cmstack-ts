import { createHash, timingSafeEqual } from 'node:crypto';
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { parseEnv } from '@typress/config';
import type { Request } from 'express';

/**
 * Constant-time string comparison that leaks neither content nor length: both
 * inputs are reduced to fixed-size SHA-256 digests before the timing-safe check.
 */
function safeEqual(a: string, b: string): boolean {
  const digestA = createHash('sha256').update(a).digest();
  const digestB = createHash('sha256').update(b).digest();
  return timingSafeEqual(digestA, digestB);
}

/**
 * Guards server-to-server endpoints (e.g. the OAuth upsert called by the web
 * app) with a shared secret sent in the `x-internal-secret` header. Prevents
 * any public caller from asserting an arbitrary identity.
 */
@Injectable()
export class InternalSecretGuard implements CanActivate {
  private readonly secret = parseEnv().INTERNAL_API_SECRET;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.headers['x-internal-secret'];
    if (typeof provided !== 'string' || !safeEqual(provided, this.secret)) {
      throw new UnauthorizedException('Invalid internal secret.');
    }
    return true;
  }
}
