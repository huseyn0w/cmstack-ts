import type { RoleRepository, UserRepository, UserWithRoleSummary } from '@cmstack-ts/db';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { UsersService } from './users.service';

function userRow(over: Partial<UserWithRoleSummary> = {}): UserWithRoleSummary {
  return {
    id: 'me',
    email: 'me@x.com',
    name: 'Me',
    image: null,
    role: { id: 'r1', name: 'Member' },
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...over,
  } as UserWithRoleSummary;
}

let users: Record<keyof UserRepository, Mock>;
let roles: Record<keyof RoleRepository, Mock>;
let service: UsersService;

beforeEach(() => {
  users = {
    findByEmailWithRole: vi.fn(),
    findByIdWithRole: vi.fn(),
    findIdByEmail: vi.fn(),
    createWithRole: vi.fn(),
    createWithRoleAndAccount: vi.fn(),
    updateProfileFields: vi.fn(),
    updatePasswordHash: vi.fn(),
    listAndCount: vi.fn(),
    findByIdSummary: vi.fn(),
    updateAdmin: vi.fn(),
    findPublicProfile: vi.fn(),
    count: vi.fn(),
    exists: vi.fn(),
    hardDelete: vi.fn(),
  };
  roles = { findIdByName: vi.fn(), findIdById: vi.fn(), list: vi.fn(), count: vi.fn() };
  service = new UsersService(
    users as unknown as UserRepository,
    roles as unknown as RoleRepository,
  );
});

describe('UsersService self-protection', () => {
  it('forbids changing your own role (anti-lockout) before any DB work', async () => {
    await expect(service.update('me', { roleId: 'role-2' }, 'me')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(users.updateAdmin).not.toHaveBeenCalled();
  });

  it('allows changing your own name (no role change)', async () => {
    users.exists.mockResolvedValue(true);
    users.updateAdmin.mockResolvedValue(userRow({ name: 'New Name' }));
    const result = await service.update('me', { name: 'New Name' }, 'me');
    expect(result.name).toBe('New Name');
    expect(users.updateAdmin).toHaveBeenCalledWith('me', { name: 'New Name' });
  });

  it('forbids deleting your own account before any DB work', async () => {
    await expect(service.remove('me', 'me')).rejects.toBeInstanceOf(ForbiddenException);
    expect(users.hardDelete).not.toHaveBeenCalled();
  });
});

describe('UsersService update validation', () => {
  it('404s an unknown user', async () => {
    users.exists.mockResolvedValue(false);
    await expect(service.update('ghost', { name: 'x' }, 'admin')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects assigning a non-existent role', async () => {
    users.exists.mockResolvedValue(true);
    roles.findIdById.mockResolvedValue(null);
    await expect(service.update('u2', { roleId: 'ghost' }, 'admin')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(users.updateAdmin).not.toHaveBeenCalled();
  });
});

describe('UsersService remove / list', () => {
  it('hard-deletes another user after the existence check', async () => {
    users.exists.mockResolvedValue(true);
    await service.remove('u2', 'admin');
    expect(users.hardDelete).toHaveBeenCalledWith('u2');
  });

  it('list maps rows and echoes paging', async () => {
    users.listAndCount.mockResolvedValue({ items: [userRow()], total: 1 });
    const result = await service.list({ page: 1, perPage: 20 });
    expect(result).toMatchObject({ total: 1, page: 1, perPage: 20 });
    expect(result.items[0]).toMatchObject({ id: 'me', role: { id: 'r1', name: 'Member' } });
  });
});
