import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import type { PrismaClient } from '@typress/db';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckPolicies } from '../authz/check-policies.decorator';
import { PoliciesGuard } from '../authz/policies.guard';
import { PRISMA } from '../prisma/prisma.module';

export interface AdminOverview {
  users: number;
  roles: number;
}

/**
 * Demonstrates role-gated access: only callers whose ability allows
 * `read Admin` (administrators, editors) may see the overview.
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class AdminController {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  @Get('overview')
  @CheckPolicies((ability) => ability.can('read', 'Admin'))
  async overview(): Promise<AdminOverview> {
    const [users, roles] = await Promise.all([this.prisma.user.count(), this.prisma.role.count()]);
    return { users, roles };
  }
}
