import { SetMetadata } from '@nestjs/common';
import type { AppAbility } from './ability';

/** A policy: given the caller's ability, decide whether the request may proceed. */
export type PolicyHandler = (ability: AppAbility) => boolean;

export const CHECK_POLICIES_KEY = 'check_policies';

/**
 * Attach one or more CASL policies to a route. Every policy must pass.
 *
 * @example
 *   @CheckPolicies((ability) => ability.can('read', 'Admin'))
 *   @UseGuards(JwtAuthGuard, PoliciesGuard)
 */
export const CheckPolicies = (...handlers: PolicyHandler[]) =>
  SetMetadata(CHECK_POLICIES_KEY, handlers);
