import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { buildAbility } from './ability';
import { CHECK_POLICIES_KEY, type PolicyHandler } from './check-policies.decorator';

/**
 * Enforces the CASL policies declared with `@CheckPolicies(...)`. Must run after
 * JwtAuthGuard, which populates `request.user`. Routes with no policies pass.
 */
@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const handlers =
      this.reflector.getAllAndOverride<PolicyHandler[]>(CHECK_POLICIES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (handlers.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Authentication required.');
    }

    const ability = buildAbility(user.permissions);
    const allowed = handlers.every((handler) => handler(ability));
    if (!allowed) {
      throw new ForbiddenException('You do not have permission to perform this action.');
    }
    return true;
  }
}
