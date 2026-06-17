import 'reflect-metadata';
import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import type { PolicyHandler } from './check-policies.decorator';
import { PoliciesGuard } from './policies.guard';

function makeContext(user?: AuthenticatedUser): ExecutionContext {
  return {
    getHandler: () => null,
    getClass: () => null,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function reflectorReturning(handlers: PolicyHandler[] | undefined): Reflector {
  return { getAllAndOverride: () => handlers } as unknown as Reflector;
}

const admin: AuthenticatedUser = {
  id: 'u1',
  email: 'admin@typress.local',
  name: 'Admin',
  image: null,
  role: { name: 'Administrator', permissions: [{ action: 'manage', subject: 'all' }] },
  permissions: [{ action: 'manage', subject: 'all' }],
};

const member: AuthenticatedUser = {
  id: 'u2',
  email: 'member@typress.local',
  name: 'Member',
  image: null,
  role: { name: 'Member', permissions: [] },
  permissions: [],
};

const requireAdmin: PolicyHandler = (ability) => ability.can('read', 'Admin');

describe('PoliciesGuard', () => {
  it('allows routes with no declared policies', () => {
    const guard = new PoliciesGuard(reflectorReturning(undefined));
    expect(guard.canActivate(makeContext())).toBe(true);
  });

  it('allows a user whose ability satisfies the policy', () => {
    const guard = new PoliciesGuard(reflectorReturning([requireAdmin]));
    expect(guard.canActivate(makeContext(admin))).toBe(true);
  });

  it('forbids a user whose ability does not satisfy the policy', () => {
    const guard = new PoliciesGuard(reflectorReturning([requireAdmin]));
    expect(() => guard.canActivate(makeContext(member))).toThrow(ForbiddenException);
  });

  it('forbids when a policy is declared but no user is present', () => {
    const guard = new PoliciesGuard(reflectorReturning([requireAdmin]));
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(ForbiddenException);
  });
});
